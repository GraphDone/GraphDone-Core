import { expect, type Locator, type TestInfo } from '@playwright/test';
import {
  measureSchematicClutter,
  schematicSegments,
} from '../../packages/web/src/lib/schematicRouting';

export async function inspectSchematicOverview(
  overview: Locator,
  info: TestInfo,
  relationships: number
) {
  const read = () =>
    overview.evaluate(host => {
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
        return true;
      };
      const rectangle = (element: Element, index: number) => {
        const bounds = element.getBoundingClientRect();
        return {
          id: element.getAttribute('data-lod-group') ?? `control-${index}`,
          x: bounds.x,
          y: bounds.y,
          width: bounds.width,
          height: bounds.height,
          visible: visible(element),
        };
      };
      const cards = Array.from(host.querySelectorAll('[data-lod-group]')).map(
        rectangle
      );
      const controls = Array.from(
        document.querySelectorAll('[data-graph-fit-obstacle="true"]')
      )
        .filter(element => element.getAttribute('role') !== 'region')
        .map(rectangle)
        .filter(rect => rect.width > 0 && rect.height > 0);
      const routes = Array.from(
        host.querySelectorAll<SVGPathElement>('[data-lod-bundle]')
      ).map(path => {
        const matrix = path.getScreenCTM()!;
        const style = getComputedStyle(path);
        return {
          source: path.getAttribute('data-lod-bus-source')!,
          count: Number(path.getAttribute('data-count')),
          painted:
            visible(path) &&
            style.stroke !== 'none' &&
            Number(style.strokeOpacity) > 0 &&
            parseFloat(style.strokeWidth) > 0 &&
            path.getTotalLength() > 0,
          points: (path.getAttribute('d')!.match(/[ML][^ML]+/g) ?? []).map(
            command => {
              const [x, y] = command.slice(1).split(',').map(Number);
              const point = new DOMPoint(x, y).matrixTransform(matrix);
              return { x: point.x, y: point.y };
            }
          ),
        };
      });
      const accounting = host
        .querySelector('[aria-label*="relationships,"]')
        ?.getAttribute('aria-label');
      const bounds = host.getBoundingClientRect();
      return {
        cards,
        controls,
        routes,
        accounting,
        bounds: {
          left: Math.max(0, bounds.left),
          right: Math.min(innerWidth, bounds.right),
          top: Math.max(0, bounds.top),
          bottom: Math.min(innerHeight, bounds.bottom),
        },
      };
    });
  await expect.poll(async () => (await read()).cards.length).toBe(2);
  await expect
    .poll(async () => (await read()).routes.length)
    .toBeGreaterThan(0);
  const geometry = await read();
  for (const card of geometry.cards) {
    expect(card.visible, 'Schematic card must be visible').toBe(true);
    expect(
      card.width,
      'Schematic card must have visible width'
    ).toBeGreaterThan(0);
    expect(card.height).toBeGreaterThan(0);
    expect(card.x).toBeGreaterThanOrEqual(geometry.bounds.left);
    expect(card.x + card.width).toBeLessThanOrEqual(geometry.bounds.right);
    expect(card.y).toBeGreaterThanOrEqual(geometry.bounds.top);
    expect(card.y + card.height).toBeLessThanOrEqual(geometry.bounds.bottom);
  }
  for (const route of geometry.routes) {
    expect(route.painted, 'Schematic wire must be painted').toBe(true);
    expect(route.count).toBeGreaterThan(0);
    expect(route.points.length).toBeGreaterThanOrEqual(2);
    expect(
      route.points.every(
        point => Number.isFinite(point.x) && Number.isFinite(point.y)
      )
    ).toBe(true);
  }
  const metrics = measureSchematicClutter(
    [...geometry.cards, ...geometry.controls],
    geometry.routes.flatMap(route =>
      schematicSegments(route.points, route.source)
    )
  );
  expect(metrics.cardIntersections).toBe(0);
  expect(metrics.unrelatedCrossings).toBe(0);
  expect(metrics.unrelatedOverlaps).toBe(0);
  expect(metrics.diagonalSegments).toBe(0);
  expect(metrics.maxBusesPerCell).toBeLessThanOrEqual(4);
  const accounting = geometry.accounting?.match(
    /^(\d+) relationships, (\d+) not drawn:/
  );
  expect(accounting).toBeTruthy();
  expect(Number(accounting![1])).toBe(relationships);
  expect(
    geometry.routes.reduce((sum, route) => sum + route.count, 0) +
      Number(accounting![2])
  ).toBe(relationships);
  await info.attach('actual-overview-geometry.json', {
    body: JSON.stringify({ ...geometry, metrics }),
    contentType: 'application/json',
  });
  await info.attach('actual-overview.png', {
    body: await overview.screenshot(),
    contentType: 'image/png',
  });
}
