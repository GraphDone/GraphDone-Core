import assert from 'node:assert/strict';
import { createServer as createHttpServer } from 'node:http';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { dirname, join, resolve, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { once } from 'node:events';
import test from 'node:test';
import { createServer, build, resolveConfig } from 'vite';
import { chromium, expect } from '@playwright/test';
import { WebSocketServer } from 'ws';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

test('installed Vite serves React HMR, forwards API routes, denies secrets and builds an offline shell', { timeout: 90000 }, async () => {
  await mkdir(join(root, 'test-artifacts'), { recursive: true });
  const fixture = await mkdtemp(join(root, 'test-artifacts/toolchain-'));
  const configFile = join(root, 'packages/web/vite.config.ts');
  const originalProxy = process.env.VITE_PROXY_TARGET;
  const originalOffline = process.env.VITE_OFFLINE_SYNC;
  let vite, browser, staticServer;
  const backend = createHttpServer((req, res) => {
    res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
    res.end(JSON.stringify({ method: req.method, path: req.url, owned: true }));
  });
  const sockets = new WebSocketServer({ server: backend });
  sockets.on('connection', (socket, request) => socket.send(JSON.stringify({ path: request.url, owned: true })));
  const closeHttp = async server => {
    if (!server?.listening) return;
    const closed = new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    server.closeAllConnections();
    await closed;
  };
  try {
    backend.listen(0, '127.0.0.1');
    await once(backend, 'listening');
    process.env.VITE_PROXY_TARGET = `http://127.0.0.1:${backend.address().port}`;
    process.env.VITE_OFFLINE_SYNC = 'false';
    await writeFile(join(fixture, 'index.html'), '<div id="root"></div><script type="module" src="/main.tsx"></script>');
    const component = label => `import React, {useState} from 'react'; export default function Probe(){const [count,setCount]=useState(0);return <button onClick={()=>setCount(count+1)}>${label} {count}</button>}`;
    await writeFile(join(fixture, 'Probe.tsx'), component('Before'));
    await writeFile(join(fixture, 'main.tsx'), "import React from 'react';import {createRoot} from 'react-dom/client';import Probe from './Probe';createRoot(document.getElementById('root')).render(<Probe/>);");
    await writeFile(join(fixture, '.env'), 'OWNED_SECRET=toolchain-fixture-only\n');
    const config = await resolveConfig({ configFile, root: fixture }, 'serve');
    assert.deepEqual(config.build.target, ['es2020', 'chrome87', 'edge88', 'firefox78', 'safari14']);
    vite = await createServer({ configFile, root: fixture, server: { host: '127.0.0.1', port: 0, strictPort: false } });
    await vite.listen();
    browser = await chromium.launch(process.env.QC_BROWSER_PORT ? { channel: 'chrome' } : {});
    const context = await browser.newContext();
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const origin = `http://127.0.0.1:${vite.httpServer.address().port}`;
    await page.goto(origin);
    await page.getByRole('button', { name: 'Before 0' }).click();
    await expect(page.getByRole('button')).toHaveText('Before 1');
    await page.evaluate(() => { window.__toolchainDocument = 'same-document'; });
    await writeFile(join(fixture, 'Probe.tsx'), component('After'));
    await expect(page.getByRole('button')).toHaveText('After 1', { timeout: 10000 });
    assert.equal(await page.evaluate(() => window.__toolchainDocument), 'same-document');
    for (const [path, method, forwarded] of [['/api/graphql?probe=1', 'POST', '/graphql?probe=1'], ['/config', 'GET', '/config'], ['/auth/login', 'POST', '/auth/login']]) {
      const value = await page.evaluate(async ({ path, method }) => (await fetch(path, { method })).json(), { path, method });
      assert.deepEqual(value, { method, path: forwarded, owned: true });
    }
    const subscription = await page.evaluate(() => new Promise((resolve, reject) => {
      const socket = new WebSocket(`${location.origin.replace('http:', 'ws:')}/api/graphql?subscription=owned`);
      const timeout = setTimeout(() => { socket.close(); reject(new Error('WebSocket proxy did not respond')); }, 5000);
      socket.onmessage = event => { clearTimeout(timeout); socket.close(); resolve(JSON.parse(event.data)); };
      socket.onerror = () => { clearTimeout(timeout); socket.close(); reject(new Error('WebSocket proxy failed')); };
    }));
    assert.deepEqual(subscription, { path: '/graphql?subscription=owned', owned: true });
    const denied = await context.request.get(`${origin}/.env`);
    assert.equal(denied.status(), 403);
    assert.ok(!(await denied.text()).includes('toolchain-fixture-only'));
    assert.deepEqual(errors, []);
    await context.close();
    await vite.close();
    vite = undefined;
    process.env.VITE_OFFLINE_SYNC = 'true';
    const dist = join(fixture, 'dist');
    await build({ configFile, root: fixture, build: { outDir: dist, emptyOutDir: true, rollupOptions: { output: { manualChunks: () => undefined } } } });
    const worker = await readFile(join(dist, 'sw.js'), 'utf8');
    assert.match(worker, /graphdone-shell-/);
    staticServer = createHttpServer(async (req, res) => {
      try {
        const pathname = new URL(req.url, 'http://localhost').pathname;
        const file = resolve(dist, pathname === '/' ? 'index.html' : `.${pathname}`);
        if (!file.startsWith(`${dist}/`)) { res.writeHead(403); res.end(); return; }
        const body = await readFile(file);
        res.writeHead(200, { 'content-type': ({ '.js': 'text/javascript', '.html': 'text/html', '.css': 'text/css' })[extname(file)] || 'application/octet-stream' });
        res.end(body);
      } catch { res.writeHead(404); res.end(); }
    });
    staticServer.listen(0, '127.0.0.1');
    await once(staticServer, 'listening');
    const offlineContext = await browser.newContext({ serviceWorkers: 'allow' });
    const offlinePage = await offlineContext.newPage();
    offlinePage.on('pageerror', error => errors.push(error.message));
    const offlineOrigin = `http://127.0.0.1:${staticServer.address().port}`;
    await offlinePage.goto(offlineOrigin);
    await expect(offlinePage.getByRole('button')).toHaveText('After 0');
    await offlinePage.evaluate(async () => {
      await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;
      if (!navigator.serviceWorker.controller) await new Promise(resolve => navigator.serviceWorker.addEventListener('controllerchange', resolve, { once: true }));
    });
    const cached = await offlinePage.evaluate(async () => (await Promise.all((await caches.keys()).map(async key => (await (await caches.open(key)).keys()).map(request => new URL(request.url).pathname)))).flat());
    assert.ok(cached.includes('/'));
    assert.ok(cached.some(path => path.endsWith('.js')));
    assert.ok(cached.every(path => !/^\/(api|auth|health|config|mcp)(\/|$)/.test(path)));
    await offlineContext.setOffline(true);
    await offlinePage.reload();
    await expect(offlinePage.getByRole('button')).toHaveText('After 0');
    await offlinePage.getByRole('button').click();
    await expect(offlinePage.getByRole('button')).toHaveText('After 1');
    assert.equal(await offlinePage.evaluate(async () => { try { await fetch('/api/graphql'); return false; } catch { return true; } }), true);
    assert.deepEqual(errors, []);
    await offlineContext.close();
  } finally {
    await browser?.close();
    await vite?.close();
    await closeHttp(staticServer);
    for (const socket of sockets.clients) socket.terminate();
    await new Promise(resolve => sockets.close(resolve));
    await closeHttp(backend);
    if (originalProxy === undefined) delete process.env.VITE_PROXY_TARGET; else process.env.VITE_PROXY_TARGET = originalProxy;
    if (originalOffline === undefined) delete process.env.VITE_OFFLINE_SYNC; else process.env.VITE_OFFLINE_SYNC = originalOffline;
    await rm(fixture, { recursive: true, force: true });
  }
});
