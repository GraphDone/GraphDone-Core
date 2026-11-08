import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// The production web container's nginx must route browser paths to the API
// paths the server actually mounts (packages/server/src/index.ts). A stripped
// /api prefix once turned /api/captcha/challenge into a 404, which broke
// production sign-in; /auth/* and /config used to fall through to the SPA.
const conf = readFileSync(new URL('../../../packages/web/nginx.conf', import.meta.url), 'utf8');

function locations(text) {
  const found = [];
  const pattern = /location\s+([^{]+?)\s*\{([^}]*)\}/g;
  for (let match; (match = pattern.exec(text));) found.push({ selector: match[1].trim(), body: match[2] });
  return found;
}

function route(path) {
  // nginx precedence for the forms used here: exact (=) first, then regex (~)
  // in order, then the longest prefix.
  const all = locations(conf);
  const exact = all.find(l => l.selector.startsWith('= ') && l.selector.slice(2).trim() === path);
  if (exact) return exact;
  const regex = all.find(l => l.selector.startsWith('~') && !l.selector.startsWith('~*')
    && new RegExp(l.selector.replace(/^~\s*/, '')).test(path));
  if (regex) return regex;
  return all.filter(l => !/^[=~]/.test(l.selector) && path.startsWith(l.selector))
    .sort((a, b) => b.selector.length - a.selector.length)[0];
}

const upstream = location => /proxy_pass\s+(\S+);/.exec(location?.body ?? '')?.[1];

test('GraphQL maps /api/graphql to the server /graphql with WebSocket upgrades', () => {
  const location = route('/api/graphql');
  assert.equal(upstream(location), 'https://graphdone-api:4128/graphql');
  assert.match(location.body, /proxy_set_header Upgrade \$http_upgrade/);
});

for (const path of ['/api/captcha/challenge', '/api/agent/discovery', '/api/ops/feedback']) {
  test(`${path} keeps its /api prefix`, () => {
    const location = route(path);
    assert.equal(upstream(location), 'https://graphdone-api:4128');
    assert.doesNotMatch(location.body, /rewrite/);
  });
}

for (const path of ['/auth/magic-link/request', '/auth/google', '/config', '/mcp/status', '/health']) {
  test(`${path} reaches the API instead of the SPA`, () => {
    assert.match(upstream(route(path)) ?? '', /^https:\/\/graphdone-api:4128/);
  });
}

for (const path of ['/authors', '/configure', '/workspace/graph']) {
  test(`${path} stays a client-side route`, () => {
    assert.equal(route(path).selector, '/');
  });
}

test('no location strips the /api prefix', () => {
  assert.doesNotMatch(conf, /rewrite\s+\^\/api/);
});
