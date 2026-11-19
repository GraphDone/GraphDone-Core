import { devices, expect, test } from '@playwright/test';
import { resolve } from 'node:path';
import { EDGE_LOD } from '../../../packages/web/src/lib/edgeLOD';
import { showPair } from '../../lib/journeys/relationshipEditor';

test.use({ ...devices['iPad Pro 11'], browserName: 'chromium' });

test('a touch pinch reveals an arrow near the bottom of the graph', async ({ page }, info) => {
  await page.setContent(`
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
      body { margin: 0; }
      .graph-container { position: absolute; inset: 201px 0 0 64px; }
      svg { width: 100%; height: 100%; touch-action: none; }
    </style>
    <div class="graph-container"><svg><g class="main-graph-group">
      <path class="edge" stroke="red" d="M 900 700 L 1227 1712" />
      <path class="arrow" fill="red" d="M -8 -4 L 8 0 L -8 4 Z" transform="translate(1227 1712)" />
    </g></svg></div>
  `);
  await page.addScriptTag({ path: resolve('node_modules/d3/dist/d3.min.js') });
  await page.evaluate(({ far, close }) => {
    const svg = document.querySelector('svg')!;
    const arrow = svg.querySelector('.arrow')!;
    const wire = svg.querySelector('.edge')!;
    const group = svg.querySelector('.main-graph-group')!;
    const d3 = (window as any).d3;
    const edge = { source: 'a', target: 'b' };
    Object.assign(arrow, { __data__: edge });
    Object.assign(wire, { __data__: edge });
    svg.dataset.contacts = '0';
    svg.addEventListener('touchstart', event => {
      svg.dataset.contacts = String(Math.max(Number(svg.dataset.contacts), event.touches.length));
    }, true);
    const zoom = d3.zoom().touchable(true).on('zoom', ({ transform }: any) => {
      group.setAttribute('transform', transform.toString());
      arrow.setAttribute('opacity', String(Math.max(0, Math.min(1, (transform.k - far) / (close - far)))));
    });
    const selection = d3.select(svg);
    selection.call(zoom);
    selection.call(zoom.transform, d3.zoomIdentity.scale(0.545318));
  }, { far: EDGE_LOD.FAR, close: EDGE_LOD.CLOSE });

  const geometry = () => page.locator('svg').evaluate(svg => {
    const arrow = svg.querySelector('.arrow')!;
    const box = arrow.getBoundingClientRect();
    return {
      scale: (svg as SVGSVGElement & { __zoom: { k: number } }).__zoom.k,
      opacity: Number(getComputedStyle(arrow).opacity),
      contacts: Number(svg.dataset.contacts),
      center: { x: box.x + box.width / 2, y: box.y + box.height / 2 },
    };
  });

  const before = await geometry();
  expect(before.opacity).toBeLessThan(0.5);
  expect(page.viewportSize()!.height - before.center.y).toBeLessThan(65);
  await showPair(page, 'a', 'b', 'BLOCKS');

  const after = await geometry();
  await info.attach('pinch-geometry.json', {
    body: JSON.stringify({ before, after }, null, 2),
    contentType: 'application/json',
  });
  expect(after.contacts).toBe(2);
  expect(after.scale).toBeGreaterThan(before.scale);
  expect(after.opacity).toBeGreaterThanOrEqual(0.5);
  expect(after.center.x).toBeCloseTo(before.center.x, 0);
  expect(after.center.y).toBeCloseTo(before.center.y, 0);
});
