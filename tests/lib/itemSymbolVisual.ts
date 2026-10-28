import { expect, type Page, type TestInfo } from '@playwright/test';
import { writeFile } from 'node:fs/promises';

export async function readItemSymbols(page: Page) {
  return page.locator('.graph-container').evaluate(host => {
    const rect = (element: Element) => {
      const box = element.getBoundingClientRect();
      return { x: box.x, y: box.y, width: box.width, height: box.height };
    };
    const overlaps = (a: ReturnType<typeof rect>, b: ReturnType<typeof rect>) =>
      a.x < b.x + b.width - 0.5 &&
      a.x + a.width > b.x + 0.5 &&
      a.y < b.y + b.height - 0.5 &&
      a.y + a.height > b.y + 0.5;
    const contains = (a: ReturnType<typeof rect>, b: ReturnType<typeof rect>) =>
      b.x >= a.x - 0.5 &&
      b.y >= a.y - 0.5 &&
      b.x + b.width <= a.x + a.width + 0.5 &&
      b.y + b.height <= a.y + a.height + 0.5;
    const viewport = rect(host);
    const visible = (element: Element) => {
      for (
        let current: Element | null = element;
        current;
        current = current.parentElement
      ) {
        const style = getComputedStyle(current);
        if (
          style.display === 'none' ||
          style.visibility !== 'visible' ||
          Number(style.opacity) === 0
        )
          return false;
      }
      const bounds = rect(element);
      return (
        bounds.width > 0 && bounds.height > 0 && overlaps(bounds, viewport)
      );
    };
    const font = (element: SVGGraphicsElement) => {
      const matrix = element.getScreenCTM()!;
      return (
        parseFloat(getComputedStyle(element).fontSize) *
        Math.hypot(matrix.a, matrix.b)
      );
    };
    const cards = Array.from(host.querySelectorAll<SVGGElement>('.node'))
      .filter(visible)
      .map(node => ({
        id: (node as any).__data__.id as string,
        detail: node.getAttribute('data-detail'),
        box: rect(node.querySelector('.node-bg')!),
        titles: Array.from(
          node.querySelectorAll<SVGGraphicsElement>('.node-title-text')
        )
          .filter(visible)
          .map(text => ({
            text: text.textContent,
            box: rect(text),
            font: font(text),
          })),
        parts: Array.from(
          node.querySelectorAll(
            '.node-type-text, .node-edit-icon, .node-relationship-icon, .node-expand-icon, .node-title-text, .node-description-text, .node-meta text'
          )
        )
          .filter(visible)
          .map(part => ({ kind: part.getAttribute('class'), box: rect(part) })),
      }));
    const labels = Array.from(
      host.querySelectorAll<SVGGElement>('.edge-label-group')
    )
      .filter(visible)
      .map(label => {
        const text = label.querySelector<SVGGraphicsElement>('.edge-label')!;
        return {
          id: (label as any).__data__.id as string,
          box: rect(label.querySelector('rect')!),
          text: rect(text),
          font: font(text),
          opacity:
            Number(getComputedStyle(label).opacity) *
            Number(getComputedStyle(text).opacity),
        };
      });
    const arrows = Array.from(host.querySelectorAll('.arrows-group .arrow'))
      .filter(visible)
      .map(rect);
    const controls = Array.from(
      document.querySelectorAll(
        '[data-graph-fit-obstacle="true"], [data-lod-controls="true"]'
      )
    )
      .filter(visible)
      .map(rect);
    const segments = Array.from(
      host.querySelectorAll<SVGPathElement>('.edges-group .edge')
    )
      .filter(visible)
      .flatMap(path => {
        const matrix = path.getScreenCTM()!;
        const points = (path.getAttribute('d')?.match(/[ML][^ML]+/g) ?? []).map(
          command => {
            const [x, y] = command.slice(1).split(',').map(Number);
            const point = new DOMPoint(x, y).matrixTransform(matrix);
            return { x: point.x, y: point.y };
          }
        );
        return points
          .slice(1)
          .map((target, index) => ({ source: points[index], target }));
      });
    const wireHits = (
      line: (typeof segments)[number],
      box: ReturnType<typeof rect>
    ) => {
      let low = 0,
        high = 1;
      for (const [axis, span] of [
        ['x', 'width'],
        ['y', 'height'],
      ] as const) {
        const delta = line.target[axis] - line.source[axis];
        const min = box[axis] + 0.5,
          max = box[axis] + box[span] - 0.5;
        if (!delta) {
          if (line.source[axis] < min || line.source[axis] > max) return false;
        } else {
          const a = (min - line.source[axis]) / delta,
            b = (max - line.source[axis]) / delta;
          low = Math.max(low, Math.min(a, b));
          high = Math.min(high, Math.max(a, b));
          if (low > high) return false;
        }
      }
      return true;
    };
    const violations: string[] = [];
    for (const card of cards) {
      for (const title of card.titles) {
        if (!contains(card.box, title.box))
          violations.push(`title-clipped:${card.id}`);
        if (title.font < 11.9) violations.push(`title-small:${card.id}`);
      }
      for (const [index, part] of card.parts.entries()) {
        if (!contains(card.box, part.box))
          violations.push(`card-part-clipped:${card.id}:${part.kind}`);
        for (const other of card.parts.slice(index + 1))
          if (overlaps(part.box, other.box))
            violations.push(
              `card-part-overlap:${card.id}:${part.kind}:${other.kind}`
            );
      }
    }
    for (const [index, label] of labels.entries()) {
      if (!contains(label.box, label.text))
        violations.push(`label-clipped:${label.id}`);
      if (!contains(viewport, label.box))
        violations.push(`label-offscreen:${label.id}`);
      if (label.font < 11.9 || label.opacity < 0.99)
        violations.push(`label-unreadable:${label.id}`);
      if (
        [
          ...cards.map(card => card.box),
          ...arrows,
          ...controls,
          ...labels.slice(index + 1).map(other => other.box),
        ].some(box => overlaps(label.box, box))
      )
        violations.push(`label-overlap:${label.id}`);
      if (segments.some(segment => wireHits(segment, label.box)))
        violations.push(`label-wire-overlap:${label.id}`);
    }
    return { viewport, cards, labels, segments, violations };
  });
}

export async function inspectItemSymbols(
  page: Page,
  info: TestInfo,
  stage: string
) {
  await expect
    .poll(async () =>
      (await readItemSymbols(page)).labels.every(label => label.opacity >= 0.99)
    )
    .toBe(true);
  const geometry = await readItemSymbols(page);
  const json = info.outputPath(`${stage}.json`),
    png = info.outputPath(`${stage}.png`);
  await writeFile(json, JSON.stringify(geometry));
  await info.attach(`${stage}.json`, {
    path: json,
    contentType: 'application/json',
  });
  await page.screenshot({ path: png });
  await info.attach(`${stage}.png`, { path: png, contentType: 'image/png' });
  expect(
    geometry.cards.length,
    'The detail view must paint useful item content'
  ).toBeGreaterThan(0);
  expect(geometry.cards.flatMap(card => card.titles).length).toBeGreaterThan(0);
  expect(geometry.violations).toEqual([]);
  return geometry;
}
