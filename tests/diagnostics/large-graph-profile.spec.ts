import { test, expect, Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { login, TEST_USERS } from '../helpers/auth';

/**
 * BASELINE profiler for the Compute Core (1000-node) example graph the user
 * called out as low-FPS. Report-only: measures idle FPS, drag-interaction FPS,
 * zoom-interaction FPS, and a DOM-weight breakdown, plus where per-frame time
 * goes (long-task sampling). Writes one JSON under test-artifacts/large-graph/.
 */
const COMPUTE_GRAPH_ID = 'subgraph-compute-shared';
const OUT = path.resolve(process.cwd(), 'test-artifacts/large-graph');

async function openGraph(page: Page, gid: string, quality: string) {
  await page.evaluate(
    ({ g, q }) => {
      localStorage.setItem('currentGraphId', g);
      localStorage.setItem('graphdone.quality.override', q);
    },
    { g: gid, q: quality }
  );
  await page.reload();
  await page.locator('.graph-container svg .node').first().waitFor({ timeout: 60_000 }).catch(() => {});
  await page.waitForTimeout(8000); // let one-shot physics settle
}

async function rafFps(page: Page, ms: number): Promise<number> {
  await page.evaluate(() => {
    (window as any).__fc = 0;
    const loop = () => { (window as any).__fc++; (window as any).__rafId = requestAnimationFrame(loop); };
    (window as any).__rafId = requestAnimationFrame(loop);
  });
  await page.waitForTimeout(ms);
  const frames = await page.evaluate(() => { cancelAnimationFrame((window as any).__rafId); return (window as any).__fc || 0; });
  return Math.round((frames / (ms / 1000)) * 10) / 10;
}

test.describe('large-graph baseline profile @geometry', () => {
  test.describe.configure({ timeout: 180_000 });

  for (const quality of ['HIGH', 'LOW']) {
    test(`compute-core profile @${quality}`, async ({ page }) => {
      fs.mkdirSync(OUT, { recursive: true });
      await page.setViewportSize({ width: 1920, height: 1080 });
      await login(page, TEST_USERS.ADMIN);
      await page.waitForTimeout(1500);
      await openGraph(page, COMPUTE_GRAPH_ID, quality);

      const renderedNodes = await page.locator('.graph-container svg .node').count();
      const renderedEdges = await page.locator('.graph-container svg .edge').count();
      const dataDense = await page.evaluate(() => document.querySelector('.graph-container')?.getAttribute('data-dense') ?? null);

      // DOM weight: total SVG elements, per-node element count, CSS filter usage.
      const dom = await page.evaluate(() => {
        const svg = document.querySelector('.graph-container svg');
        const all = svg ? svg.querySelectorAll('*').length : 0;
        const nodes = document.querySelectorAll('.graph-container svg .node').length;
        const texts = svg ? svg.querySelectorAll('text').length : 0;
        const fos = svg ? svg.querySelectorAll('foreignObject').length : 0;
        const filtered = document.querySelectorAll('.graph-container [style*="filter"], .graph-container [filter]').length;
        const blur = Array.from(document.querySelectorAll('.graph-container *')).filter((e) => {
          const s = getComputedStyle(e as Element);
          return s.backdropFilter !== 'none' || s.filter !== 'none';
        }).length;
        return { totalSvgEls: all, nodes, texts, foreignObjects: fos, inlineFilterEls: filtered, blurOrFilterEls: blur, perNodeEls: nodes ? Math.round(all / nodes) : 0 };
      });

      // Idle FPS (nothing happening, physics stopped).
      const idleFps = await rafFps(page, 3000);

      // Drag-interaction FPS: hold a node and move it for 5s (sim ticks while dragging).
      const box = await page.evaluate(() => {
        const n = document.querySelector('.graph-container svg .node .node-bg') as Element | null;
        if (!n) return null;
        const r = n.getBoundingClientRect();
        return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
      });
      let dragFps = -1;
      if (box) {
        await page.evaluate(() => { (window as any).__fc = 0; const loop = () => { (window as any).__fc++; (window as any).__rafId = requestAnimationFrame(loop); }; (window as any).__rafId = requestAnimationFrame(loop); });
        await page.mouse.move(box.x, box.y);
        await page.mouse.down();
        const t = Date.now();
        let a = 0;
        while (Date.now() - t < 5000) { a += 0.6; await page.mouse.move(box.x + Math.cos(a) * 80, box.y + Math.sin(a) * 60); await page.waitForTimeout(110); }
        await page.mouse.up();
        const frames = await page.evaluate(() => { cancelAnimationFrame((window as any).__rafId); return (window as any).__fc || 0; });
        dragFps = Math.round((frames / ((Date.now() - t) / 1000)) * 10) / 10;
      }

      // Zoom-interaction FPS: wheel-zoom repeatedly for 4s.
      await page.mouse.move(960, 540);
      await page.evaluate(() => { (window as any).__fc = 0; const loop = () => { (window as any).__fc++; (window as any).__rafId = requestAnimationFrame(loop); }; (window as any).__rafId = requestAnimationFrame(loop); });
      const zt = Date.now();
      let dir = -1;
      while (Date.now() - zt < 4000) { dir = -dir; await page.mouse.wheel(0, dir * 120); await page.waitForTimeout(60); }
      const zframes = await page.evaluate(() => { cancelAnimationFrame((window as any).__rafId); return (window as any).__fc || 0; });
      const zoomFps = Math.round((zframes / ((Date.now() - zt) / 1000)) * 10) / 10;

      // Zoomed-IN drag: zoom in hard so most of the graph is off-screen, then
      // drag. This is where viewport culling should help (the fit-view drag above
      // keeps every node on screen, so culling can't help there).
      await page.mouse.move(960, 540);
      for (let i = 0; i < 10; i++) { await page.mouse.wheel(0, 200); await page.waitForTimeout(60); }
      await page.waitForTimeout(500);
      const zoomState = await page.evaluate(() => {
        const g = document.querySelector('.graph-container svg g');
        const tr = g?.getAttribute('transform') ?? '';
        const m = tr.match(/scale\(([0-9.]+)\)/);
        const nodes = Array.from(document.querySelectorAll('.graph-container svg .node'));
        const hidden = nodes.filter((n) => getComputedStyle(n).display === 'none').length;
        return { transform: tr.slice(0, 60), scale: m ? parseFloat(m[1]) : null, hidden, total: nodes.length };
      });
      const culledHidden = zoomState.hidden;
      // eslint-disable-next-line no-console
      console.log(`[profile] ${quality} zoomState: scale=${zoomState.scale} hidden=${zoomState.hidden}/${zoomState.total} tr="${zoomState.transform}"`);
      const zinBox = await page.evaluate(() => {
        const n = document.querySelector('.graph-container svg .node .node-bg') as Element | null;
        if (!n) return { x: 960, y: 540 };
        const r = n.getBoundingClientRect();
        return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
      });
      await page.evaluate(() => { (window as any).__fc = 0; const loop = () => { (window as any).__fc++; (window as any).__rafId = requestAnimationFrame(loop); }; (window as any).__rafId = requestAnimationFrame(loop); });
      await page.mouse.move(zinBox.x, zinBox.y);
      await page.mouse.down();
      const zt2 = Date.now();
      let aa = 0;
      while (Date.now() - zt2 < 4000) { aa += 0.6; await page.mouse.move(zinBox.x + Math.cos(aa) * 60, zinBox.y + Math.sin(aa) * 45); await page.waitForTimeout(110); }
      await page.mouse.up();
      const zinFrames = await page.evaluate(() => { cancelAnimationFrame((window as any).__rafId); return (window as any).__fc || 0; });
      const zoomedInDragFps = Math.round((zinFrames / ((Date.now() - zt2) / 1000)) * 10) / 10;

      const result = { graph: COMPUTE_GRAPH_ID, quality, dataDense, renderedNodes, renderedEdges, idleFps, dragFps, zoomFps, zoomedInDragFps, culledHidden, dom };
      fs.writeFileSync(path.join(OUT, `compute-${quality}.json`), JSON.stringify(result, null, 2));
      // eslint-disable-next-line no-console
      console.log(`[profile] ${quality}: dense=${dataDense} nodes=${renderedNodes} edges=${renderedEdges} idleFps=${idleFps} dragFps=${dragFps} zoomFps=${zoomFps} zoomInDragFps=${zoomedInDragFps} culledHidden=${culledHidden} perNodeEls=${dom.perNodeEls} totalSvgEls=${dom.totalSvgEls}`);
      expect(renderedNodes, 'compute core renders nodes').toBeGreaterThan(0);
    });
  }
});
