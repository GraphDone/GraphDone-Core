import { devices, expect, test } from '@playwright/test';
import { resolve } from 'node:path';
import { openGraphView } from '../../lib/journeys/workspace';
import { touchGesture, visibleTileCenter, splitSiblingContacts, type TouchPoint } from '../../lib/journeys/touchContacts';

test.use({ ...devices['iPhone 14'], browserName: 'chromium' });

test('a selected mobile Graph view can finish loading without clicking the tab again @mobile', async ({ page }) => {
  await page.setContent(`
    <nav data-testid="mobile-bottom-nav"><button aria-pressed="true">Graph</button></nav>
    <script>
      document.querySelector('button').onclick = () => document.body.dataset.reselected = 'true';
    </script>
  `);
  await page.evaluate(() => setTimeout(() => {
    const graph = document.createElement('div');
    graph.className = 'graph-container';
    graph.textContent = 'Welcome';
    document.body.appendChild(graph);
  }, 400));
  await openGraphView(page);
  await expect(page.locator('.graph-container')).toHaveText('Welcome');
  await expect(page.locator('body')).not.toHaveAttribute('data-reselected', 'true');
});

for (const state of ['aria-pressed="false"', '']) {
  test(`Graph opens from List using the ${state ? 'current' : 'legacy'} mobile tab @mobile`, async ({ page }) => {
    await page.setContent(`
      <nav data-testid="mobile-bottom-nav"><button ${state}>Graph</button></nav>
      <script>
        document.querySelector('button').onclick = event => {
          event.currentTarget.setAttribute('aria-pressed', 'true');
          const graph = document.createElement('div');
          graph.className = 'graph-container';
          graph.textContent = 'Welcome';
          document.body.appendChild(graph);
        };
      </script>
    `);
    await openGraphView(page);
    await expect(page.getByRole('button', { name: 'Graph', pressed: true })).toBeVisible();
    await expect(page.locator('.graph-container')).toHaveText('Welcome');
  });
}

test('a failed check during a phone pinch releases both contacts @mobile', async ({ page }) => {
  await page.setContent(`
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <style>body { margin: 0; height: 100vh; touch-action: none }</style>
    <script>
      for (const type of ['touchstart', 'touchend', 'touchcancel']) {
        document.addEventListener(type, event => {
          document.body.dataset.contacts = String(event.touches.length);
        });
      }
    </script>
  `);
  const frames: [TouchPoint, TouchPoint][] = [
    [{ x: 100, y: 120 }, { x: 140, y: 120 }],
    [{ x: 90, y: 120 }, { x: 150, y: 120 }],
  ];
  const failure = new Error('interrupted phone gesture');
  await expect(touchGesture(page, frames, async () => {
    await expect(page.locator('body')).toHaveAttribute('data-contacts', '2');
    throw failure;
  })).rejects.toBe(failure);
  await expect(page.locator('body')).toHaveAttribute('data-contacts', '0');
  await touchGesture(page, frames);
  await expect(page.locator('body')).toHaveAttribute('data-contacts', '0');
});

test('an obstructed sibling can be reached by panning the visible mobile canvas @mobile', async ({ page }) => {
  await page.setContent(`
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <style>
      body { margin: 0; }
      header { position: fixed; inset: 0 0 auto; height: 140px; }
      .graph-container { position: fixed; inset: 140px 0 60px; }
      svg { width: 100%; height: 100%; touch-action: none; }
    </style>
    <header>Welcome</header><div class="graph-container"><svg>
      <g id="world"><g data-zoom-tile="sibling" role="button" aria-label="Fix bugs"><rect x="65" y="-106" width="100" height="80" /></g></g>
    </svg></div>
  `);
  await page.addScriptTag({ path: resolve('node_modules/d3/dist/d3.min.js') });
  await page.evaluate(() => {
    const svg = document.querySelector('svg')!;
    svg.addEventListener('touchstart', event => {
      if (event.target === svg && event.touches.length === 1) svg.dataset.backgroundTouch = 'true';
    });
    const d3 = (window as any).d3;
    d3.select(svg).call(d3.zoom().touchable(true).on('zoom', ({ transform }: any) => {
      document.getElementById('world')!.setAttribute('transform', transform.toString());
    }));
  });
  const tile = page.getByRole('button', { name: 'Fix bugs' });
  const oldBox = (await tile.boundingBox())!;
  expect(oldBox.y + oldBox.height / 2).toBe(74);
  expect(await page.evaluate(() => document.elementFromPoint(115, 74)?.tagName)).toBe('HEADER');
  const center = await visibleTileCenter(page, tile, 20);
  await expect(page.locator('svg')).toHaveAttribute('data-background-touch', 'true');
  const hits = await page.evaluate(({ x, y }) => [-20, 0, 20].map(offset =>
    document.elementFromPoint(x + offset, y)?.closest('[data-zoom-tile]')?.getAttribute('data-zoom-tile')
  ), center);
  expect(hits).toEqual(['sibling', 'sibling', 'sibling']);
});

test('two graph contacts hit their painted targets when the phone page is already magnified @mobile', async ({ page }) => {
  await page.setContent(`
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <style>body { margin: 0; width: 100vw; height: 100vh; }</style>
  `);
  const nativePinch = Array.from({ length: 14 }, (_, i) => [
    { x: 195 - 20 - i * 7, y: 350 }, { x: 195 + 20 + i * 7, y: 350 },
  ]);
  await touchGesture(page, nativePinch);
  const center = await page.evaluate(() => {
    const view = visualViewport!;
    const x = Math.round(view.offsetLeft + view.width / 2), y = Math.round(view.offsetTop + view.height / 2);
    for (const offset of [-20, 20]) {
      const item = document.createElement('button');
      item.id = offset < 0 ? 'left-contact' : 'right-contact';
      item.style.cssText = `position:absolute;left:${x + offset - 5}px;top:${y - 5}px;width:10px;height:10px;padding:0;touch-action:none;`;
      document.body.appendChild(item);
    }
    document.addEventListener('touchstart', event => {
      document.body.dataset.actualHits = Array.from(event.touches).map(t => (t.target as Element).id).join(',');
    }, true);
    return { x, y, scale: view.scale, left: view.offsetLeft, top: view.offsetTop };
  });
  expect(center.scale).toBeGreaterThan(1);
  expect(center.left + center.top).toBeGreaterThan(15);
  await touchGesture(page, [
    [{ x: center.x - 20, y: center.y }, { x: center.x + 20, y: center.y }],
    [{ x: center.x - 25, y: center.y }, { x: center.x + 26, y: center.y }],
  ], async () => {
    await expect(page.locator('body')).toHaveAttribute('data-actual-hits', 'left-contact,right-contact');
  });
});

for (const offset of [0, 480]) {
  test(`a cropped phone overview offers a split pinch ${offset ? 'after a canvas pan' : 'at its existing camera'} @mobile`, async ({ page }) => {
    await page.setContent(`
      <meta name="viewport" content="width=device-width,initial-scale=1">
      <style>body { margin: 0 } .graph-container { position: absolute; inset: 153px 0 87px } svg { width: 100%; height: 100%; touch-action: none; }</style>
      <div class="graph-container" data-zoom-level="2"><svg>
        <g class="main-graph-group"><rect class="background" width="100%" height="100%" fill="#234"/></g>
        <g id="tiles" transform="translate(${offset} 0)">
        <g data-zoom-tile="welcome" role="button" aria-label="Welcome graph, 4 items"><rect class="zoom-tile-bg" x="62" y="130" width="151" height="95" rx="14"/></g>
        <g data-zoom-tile="fix" role="button" aria-label="Fix bugs graph, 6 items"><rect class="zoom-tile-bg" x="259" y="130" width="151" height="95" rx="14"/></g>
        <g data-zoom-tile="ideas" role="button" aria-label="Ideas graph, 5 items"><rect class="zoom-tile-bg" x="-135" y="130" width="151" height="95" rx="14"/></g>
        <g data-zoom-tile="plan" role="button" aria-label="Plan a launch graph, 12 items"><rect class="zoom-tile-bg" x="62" y="253" width="151" height="95" rx="14"/></g>
        </g>
      </svg></div>
    `);
    await page.addScriptTag({ path: resolve('node_modules/d3/dist/d3.min.js') });
    await page.evaluate(offset => {
      const d3 = (window as any).d3;
      d3.select('svg').call(d3.zoom().touchable(true).on('zoom', ({ transform }: any) => {
        document.getElementById('tiles')!.setAttribute('transform', `translate(${offset + transform.x} ${transform.y})`);
      }));
      window.addEventListener('touchstart', event => {
        if (event.touches.length === 1 && (event.target as Element).matches('rect.background')) document.body.dataset.panned = 'true';
        if (event.touches.length === 2) document.body.dataset.targets = Array.from(event.touches, touch =>
          (touch.target as Element).closest('[data-zoom-tile]')?.getAttribute('data-zoom-tile')).join(',');
      }, true);
    }, offset);
    const pair = await splitSiblingContacts(page, 'welcome');
    expect(await page.locator('body').getAttribute('data-panned')).toBe(offset ? 'true' : null);
    expect(new Set(pair.ids).size).toBe(2);
    expect(pair.ids).not.toContain('welcome');
    expect(await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.matches('rect.background'), pair.midpoint)).toBe(true);
    await touchGesture(page, [pair.contacts, pair.spread]);
    await expect(page.locator('body')).toHaveAttribute('data-targets', pair.ids.join(','));
  });
}
