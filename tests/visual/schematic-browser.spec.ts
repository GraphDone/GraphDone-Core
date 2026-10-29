import { buildSync } from 'esbuild';
import { test, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { schematicFixtures } from './schematic-fixtures.mjs';

test.beforeAll(({}, info) => {
  execFileSync(
    process.execPath,
    [
      'scripts/render-schematic-routing.mjs',
      '--out',
      join(info.project.outputDir, 'fixtures'),
    ],
    { timeout: 5000 }
  );
});

for (const fixture of schematicFixtures)
  test(`${fixture.name}: schematic labels and wires remain visible without a database @schematic-visual`, async ({
    page,
  }, info) => {
    await page.setViewportSize({
      width: fixture.width,
      height: fixture.height,
    });
    const requests: string[] = [];
    await page.route('**/*', route => {
      requests.push(route.request().url());
      return route.abort();
    });
    await page.setContent(
      '<style>body{margin:0;background:#080f1d}</style>' +
        readFileSync(
          join(info.project.outputDir, 'fixtures', `${fixture.name}.svg`),
          'utf8'
        )
    );
    await page.evaluate(async () => {
      await document.fonts.ready;
    });
    await expect(page.locator('[data-card]')).toHaveCount(fixture.cards.length);
    expect(await page.locator('[data-source]').count()).toBeGreaterThanOrEqual(
      fixture.minimumRoutes
    );
    const geometry = await page.locator('[data-card]').evaluateAll(cards =>
      cards.map(card => {
        const rect = card.querySelector('rect') as SVGRectElement;
        const bounds = rect.getBBox();
        const labels = Array.from(
          card.querySelectorAll<SVGTextElement>('text')
        ).map(text => {
          const box = text.getBBox();
          return {
            text: text.textContent,
            x: box.x,
            y: box.y,
            width: box.width,
            height: box.height,
          };
        });
        return {
          id: card.getAttribute('data-card'),
          bounds: {
            x: bounds.x,
            y: bounds.y,
            width: bounds.width,
            height: bounds.height,
          },
          labels,
        };
      })
    );
    for (const card of geometry) {
      for (const label of card.labels) {
        expect(
          label.x,
          `${card.id} label starts inside its card`
        ).toBeGreaterThanOrEqual(card.bounds.x + 8);
        expect(
          label.x + label.width,
          `${card.id} label fits horizontally`
        ).toBeLessThanOrEqual(card.bounds.x + card.bounds.width - 8);
        expect(label.y).toBeGreaterThanOrEqual(card.bounds.y + 4);
        expect(label.y + label.height).toBeLessThanOrEqual(
          card.bounds.y + card.bounds.height - 4
        );
      }
      expect(
        card.labels[0].y + card.labels[0].height,
        `${card.id} title and counts must not overlap`
      ).toBeLessThanOrEqual(card.labels[1].y);
    }
    expect(requests).toEqual([]);
    const geometryPath = info.outputPath('rendered-label-geometry.json');
    writeFileSync(geometryPath, JSON.stringify(geometry));
    await info.attach('rendered-label-geometry.json', {
      path: geometryPath,
      contentType: 'application/json',
    });
    const screenshotPath = info.outputPath('schematic.png');
    await page.screenshot({ path: screenshotPath });
    await info.attach('schematic.png', {
      path: screenshotPath,
      contentType: 'image/png',
    });
  });

for (const shared of [false, true])
  test(`${shared ? 'shared bus branch survives pointer-down focus' : 'overlapping bus targets select the nearest wire and retain keyboard ownership'} @schematic-visual`, async ({
    page,
  }, info) => {
    await page.setViewportSize({ width: 800, height: 600 });
    const requests: string[] = [];
    await page.route('**/*', route => {
      requests.push(route.request().url());
      return route.abort();
    });
    const bundle = buildSync({
      entryPoints: ['tests/visual/overview-bus-fixture.tsx'],
      bundle: true,
      write: false,
      platform: 'browser',
      format: 'iife',
      jsx: 'automatic',
      define: { 'process.env.NODE_ENV': '"production"' },
    }).outputFiles[0].text;
    await page.setContent(
      '<style>body{margin:0;background:#0f172a;color:white;font-family:sans-serif}#fixture{position:relative;width:800px;height:600px;pointer-events:none}svg{position:absolute;inset:0;width:100%;height:100%}[data-lod-bus-hint]{position:absolute;z-index:20;pointer-events:auto;background:#020617;border:1px solid #5eead4;padding:16px;box-sizing:border-box;font-size:14px;font-weight:500}</style><div id="fixture"></div>'
    );
    if (shared)
      await page.evaluate(() => {
        document.body.dataset.fixture = 'shared';
      });
    await page.addScriptTag({ content: bundle });
    if (shared) {
      const branch = page.getByRole('button', {
        name: 'Inspect shared → B target: 1 relationship',
      });
      await expect(branch).toBeAttached();
      await page.mouse.move(400, 250);
      await expect(page.locator('body')).toHaveAttribute(
        'data-highlighted-bus',
        'B'
      );
      await page.mouse.move(200, 100);
      await expect(page.locator('body')).toHaveAttribute(
        'data-highlighted-bus',
        'B'
      );
      const nativeHit = await page.evaluate(() =>
        document.elementFromPoint(200, 100)?.getAttribute('data-lod-bus-hit')
      );
      expect(nativeHit).toBe('C');
      await page.mouse.down();
      await expect(branch).toBeFocused();
      await page.mouse.up();
      await expect(page.locator('body')).toHaveAttribute(
        'data-inspected-bus',
        'B'
      );
      await expect(page.locator('body')).toHaveAttribute(
        'data-return-bus',
        'B'
      );
      expect(requests).toEqual([]);
      const screenshot = info.outputPath('shared-bus-branch.png');
      await page.screenshot({ path: screenshot });
      await info.attach('shared-bus-branch', {
        path: screenshot,
        contentType: 'image/png',
      });
      const receipt = info.outputPath('shared-bus-branch.json');
      writeFileSync(
        receipt,
        JSON.stringify({
          nativeHit,
          hovered: 'B',
          focused: 'B',
          inspected: 'B',
          requests,
        })
      );
      await info.attach('shared-bus-branch', {
        path: receipt,
        contentType: 'application/json',
      });
      return;
    }
    const a = page.getByRole('button', {
      name: 'Inspect A → A target: 1 relationship',
    });
    const b = page.getByRole('button', {
      name: 'Inspect B → B target: 1 relationship',
    });
    await expect(a).toBeAttached();
    const topHit = await page.evaluate(() =>
      document.elementFromPoint(200, 100)?.getAttribute('data-lod-bus-hit')
    );
    expect(topHit).toBe('B');
    await page.mouse.move(200, 100);
    await expect(page.locator('body')).toHaveAttribute(
      'data-highlighted-bus',
      'A'
    );
    await expect(page.getByRole('tooltip')).toContainText('A → A target');
    await page.mouse.move(200, 106);
    await expect(page.locator('body')).toHaveAttribute(
      'data-highlighted-bus',
      'B'
    );
    await page.mouse.move(200, 100);
    await page.mouse.click(200, 100);
    await expect(page.locator('body')).toHaveAttribute(
      'data-inspected-bus',
      'A'
    );
    await expect(page.locator('body')).toHaveAttribute('data-return-bus', 'A');
    await expect(a).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(b).toBeFocused();
    await expect(page.locator('body')).toHaveAttribute(
      'data-highlighted-bus',
      'B'
    );
    await expect(b).toHaveAttribute(
      'aria-describedby',
      (await page.getByRole('tooltip').getAttribute('id'))!
    );
    await page.mouse.move(50, 50);
    await page.mouse.move(200, 100);
    await expect(page.locator('body')).toHaveAttribute(
      'data-highlighted-bus',
      'A'
    );
    await expect(b).toBeFocused();
    const focused = page.locator('[data-bus-focused="true"]');
    await expect(focused).toHaveAttribute('data-lod-bus-source', 'B');
    await expect(focused).toHaveAttribute('stroke-width', '5');
    await expect(focused).toHaveAttribute('opacity', '1');
    await page.keyboard.press('Enter');
    await expect(page.locator('body')).toHaveAttribute(
      'data-inspected-bus',
      'B'
    );
    await expect(page.locator('body')).toHaveAttribute('data-return-bus', 'B');
    expect(requests).toEqual([]);
    await page.evaluate(
      () =>
        new Promise<void>(resolve =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
        )
    );
    const screenshot = info.outputPath('overlapping-bus-input.png');
    await page.screenshot({ path: screenshot });
    await info.attach('overlapping-bus-input', {
      path: screenshot,
      contentType: 'image/png',
    });
    const receipt = info.outputPath('overlapping-bus-input.json');
    writeFileSync(
      receipt,
      JSON.stringify({
        topHit,
        centerLine: 'A',
        pointerInspection: 'A',
        keyboardInspection: 'B',
        focus: 'B',
        requests,
      })
    );
    await info.attach('overlapping-bus-input', {
      path: receipt,
      contentType: 'application/json',
    });
  });
