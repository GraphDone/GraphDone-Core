import { expect, type Page, type TestInfo } from '@playwright/test';
import { writeFile } from 'node:fs/promises';

type Original = {
  id: string;
  type: string;
  source: { id: string };
  target: { id: string };
};
export async function inspectOverviewBus(
  page: Page,
  info: TestInfo,
  originals: readonly Original[],
  groups: Readonly<Record<string, string>>,
  advance?: (milliseconds: number) => Promise<void>
) {
  const paint = async (milliseconds = 32) => {
    if (advance) await advance(milliseconds);
    else
      await page.evaluate(
        () =>
          new Promise<void>(resolve =>
            requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
          )
      );
  };
  const camera = () =>
    page.locator('.graph-container > svg').evaluate(svg => {
      const value = (
        svg as SVGSVGElement & { __zoom: { x: number; y: number; k: number } }
      ).__zoom;
      return { x: value.x, y: value.y, k: value.k };
    });
  const before = await camera();
  const priority = page.getByRole('combobox', {
    name: 'Relationship priority',
    exact: true,
  });
  const oldPriority = await priority.inputValue();
  await priority.selectOption('all');
  await paint();
  const target = await page.locator('[data-lod-bus-hit]').evaluateAll(paths => {
    const distance = (path: Element, point: { x: number; y: number }) => {
      const values = path
        .getAttribute('d')!
        .replace(/[ML]/g, ' ')
        .trim()
        .split(/[ ,]+/)
        .map(Number);
      let best = Infinity;
      for (let index = 2; index < values.length; index += 2) {
        const x = values[index - 2],
          y = values[index - 1],
          dx = values[index] - x,
          dy = values[index + 1] - y;
        const fraction = Math.max(
          0,
          Math.min(
            1,
            ((point.x - x) * dx + (point.y - y) * dy) / (dx * dx + dy * dy)
          )
        );
        best = Math.min(
          best,
          Math.hypot(point.x - x - fraction * dx, point.y - y - fraction * dy)
        );
      }
      return best;
    };
    for (const path of paths as SVGPathElement[]) {
      const id = path.getAttribute('data-lod-bus-hit')!;
      const [source, target] = JSON.parse(id) as string[];
      const visible = [...document.querySelectorAll('[data-lod-bundle]')].find(
        element =>
          element.getAttribute('data-lod-bus-source') === source &&
          element.getAttribute('data-lod-bus-target') === target
      );
      const count = Number(visible?.getAttribute('data-count'));
      if (!count || count > 250) continue;
      const length = path.getTotalLength();
      for (const ratio of [0.5, 0.35, 0.65, 0.2, 0.8]) {
        const point = path.getPointAtLength(length * ratio),
          next = path.getPointAtLength(length * ratio + 0.1);
        const offset = new DOMPoint(
          point.x + (next.x === point.x ? 6 : 0),
          point.y + (next.y === point.y ? 6 : 0)
        ).matrixTransform(path.getScreenCTM()!);
        const local = new DOMPoint(offset.x, offset.y).matrixTransform(
          path.getScreenCTM()!.inverse()
        );
        const ownDistance = distance(path, local);
        if (paths.some(other => distance(other, local) < ownDistance - 1e-6))
          continue;
        if (document.elementFromPoint(offset.x, offset.y) === path)
          return {
            id,
            source,
            target,
            count,
            x: offset.x,
            y: offset.y,
            hitWidth: Number(
              getComputedStyle(path).strokeWidth.replace('px', '')
            ),
          };
      }
    }
    return null;
  });
  expect(
    target,
    'A drawn bus must offer a usable pointer target away from the thin center line'
  ).not.toBeNull();
  if (!target) throw Error('No inspectable overview bus');
  expect(target.hitWidth).toBeGreaterThanOrEqual(24);
  const sourcePath = JSON.parse(target.source),
    targetPath = JSON.parse(target.target);
  expect(sourcePath).toHaveLength(3);
  expect(targetPath).toHaveLength(3);
  const expected = originals
    .filter(
      edge =>
        groups[edge.source.id] === sourcePath[2] &&
        groups[edge.target.id] === targetPath[2]
    )
    .map(edge => edge.id)
    .sort();
  expect(expected).toHaveLength(target.count);
  const hit = page
    .locator('[data-lod-bus-hit]')
    .nth(
      await page
        .locator('[data-lod-bus-hit]')
        .evaluateAll(
          (paths, id) =>
            paths.findIndex(
              path => path.getAttribute('data-lod-bus-hit') === id
            ),
          target.id
        )
    );
  await page.mouse.move(target.x, target.y);
  await paint();
  await expect(page.getByRole('tooltip')).toBeVisible();
  const highlighted = await page
    .locator('[data-bus-highlighted="true"]')
    .evaluateAll(elements =>
      elements.map(element => element.getAttribute('data-lod-group')).sort()
    );
  expect(highlighted).toEqual([target.source, target.target].sort());
  const geometry = await page.getByRole('tooltip').evaluate(el => {
    const rect = el.getBoundingClientRect();
    return {
      x: rect.x,
      y: rect.y,
      right: rect.right,
      bottom: rect.bottom,
      font: Number.parseFloat(getComputedStyle(el).fontSize),
      weight: Number.parseInt(getComputedStyle(el).fontWeight),
      overflow: el.scrollWidth - el.clientWidth,
    };
  });
  expect(geometry.font).toBeGreaterThanOrEqual(14);
  expect(geometry.weight).toBeGreaterThanOrEqual(500);
  expect(geometry.overflow).toBeLessThanOrEqual(1);
  expect(geometry.x).toBeGreaterThanOrEqual(0);
  expect(geometry.y).toBeGreaterThanOrEqual(0);
  expect(geometry.right).toBeLessThanOrEqual(page.viewportSize()!.width);
  expect(geometry.bottom).toBeLessThanOrEqual(page.viewportSize()!.height);
  if (page.viewportSize()!.width >= 1024) {
    const cards = await page.locator('[data-lod-group]').evaluateAll(elements =>
      elements.map(element => {
        const r = element.getBoundingClientRect();
        return { x: r.x, y: r.y, right: r.right, bottom: r.bottom };
      })
    );
    for (const card of cards)
      expect(
        geometry.x < card.right &&
          geometry.right > card.x &&
          geometry.y < card.bottom &&
          geometry.bottom > card.y
      ).toBe(false);
  }
  const screenshot = info.outputPath('overview-bus-hover.png');
  await page.screenshot({ path: screenshot });
  await info.attach('overview-bus-hover', {
    path: screenshot,
    contentType: 'image/png',
  });
  if (page.viewportSize()!.width >= 1024) {
    const targets = page.locator('[data-lod-bus-hit]');
    const count = await targets.count();
    expect(count).toBeGreaterThan(1);
    const index = await targets.evaluateAll(
      (paths, id) =>
        paths.findIndex(path => path.getAttribute('data-lod-bus-hit') === id),
      target.id
    );
    const next = targets.nth(index < count - 1 ? index + 1 : index - 1);
    await hit.focus();
    await page.keyboard.press(index < count - 1 ? 'Tab' : 'Shift+Tab');
    await expect(next).toBeFocused();
    const nextId = (await next.getAttribute('data-lod-bus-hit'))!;
    await expect(next).toHaveAttribute(
      'aria-describedby',
      (await page.getByRole('tooltip').getAttribute('id'))!
    );
    expect(
      await page
        .locator('[data-bus-highlighted="true"]')
        .evaluateAll(elements =>
          elements.map(element => element.getAttribute('data-lod-group')).sort()
        )
    ).toEqual(JSON.parse(nextId).sort());
    await paint();
    const mixed = info.outputPath('overview-bus-keyboard-after-hover.png');
    await page.screenshot({ path: mixed });
    await info.attach('overview-bus-keyboard-after-hover', {
      path: mixed,
      contentType: 'image/png',
    });
    await page.mouse.move(0, 0);
    await page.mouse.move(target.x, target.y);
    await expect(next).toBeFocused();
    expect(
      await page.locator('[data-bus-focused="true"]').evaluateAll(elements =>
        elements.map(element => ({
          source: element.getAttribute('data-lod-bus-source'),
          target: element.getAttribute('data-lod-bus-target'),
          width: Number(
            getComputedStyle(element).strokeWidth.replace('px', '')
          ),
          opacity: Number(getComputedStyle(element).opacity),
        }))
      )
    ).toEqual([
      {
        source: JSON.parse(nextId)[0],
        target: JSON.parse(nextId)[1],
        width: 5,
        opacity: 1,
      },
    ]);
    await hit.focus();
  }
  await page.mouse.click(target.x, target.y);
  const browser = page.getByRole('region', {
    name: 'Graph relationships',
    exact: true,
  });
  await expect(browser).toBeVisible();
  await expect(browser.locator('[data-lod-edge-id]')).toHaveCount(
    expected.length
  );
  const shown = await browser
    .locator('[data-lod-edge-id]')
    .evaluateAll(elements =>
      elements.map(element => element.getAttribute('data-lod-edge-id')).sort()
    );
  expect(shown).toEqual(expected);
  await browser
    .getByRole('button', { name: 'Back to overview', exact: true })
    .click();
  await expect(hit).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('tooltip')).toHaveCount(0);
  await page.keyboard.press('Space');
  await expect(browser).toBeVisible();
  await browser
    .getByRole('button', { name: 'Back to overview', exact: true })
    .click();
  await expect(hit).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(browser).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(browser).toHaveCount(0);
  await expect(hit).toBeFocused();
  await page.mouse.move(0, 0);
  await priority.focus();
  await paint(160);
  await expect(page.locator('[data-bus-highlighted="true"]')).toHaveCount(0);
  await priority.selectOption(oldPriority);
  await paint();
  expect(await camera()).toEqual(before);
  const receipt = info.outputPath('overview-bus-inspection.json');
  await writeFile(
    receipt,
    JSON.stringify(
      { target, highlighted, geometry, expected, shown, camera: before },
      null,
      2
    )
  );
  await info.attach('overview-bus-inspection', {
    path: receipt,
    contentType: 'application/json',
  });
}
