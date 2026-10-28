import { test, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
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
    await info.attach('rendered-label-geometry.json', {
      body: JSON.stringify(geometry),
      contentType: 'application/json',
    });
    await info.attach('schematic.png', {
      body: await page.screenshot(),
      contentType: 'image/png',
    });
  });
