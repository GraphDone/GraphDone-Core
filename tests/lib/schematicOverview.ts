import { expect, type Locator, type TestInfo } from '@playwright/test';
import { writeFileSync } from 'node:fs';
import {
  measureSchematicClutter,
  measureSchematicClearance,
  schematicSegments,
} from '../../packages/web/src/lib/schematicRouting';

export async function inspectSchematicOverview(
  overview: Locator,
  info: TestInfo,
  relationships: number,
  stage = 'overview',
  expectedCards = 2
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
          trace: element.hasAttribute('data-lod-trace'),
          x: bounds.x,
          y: bounds.y,
          width: bounds.width,
          height: bounds.height,
          visible: visible(element),
          titleSize: element.hasAttribute('data-lod-group')
            ? parseFloat(
                getComputedStyle(element.querySelector('span')!).fontSize
              )
            : null,
        };
      };
      const cards = Array.from(host.querySelectorAll('[data-lod-group]')).map(
        rectangle
      );
      const controls = Array.from(
        document.querySelectorAll('[data-graph-fit-obstacle="true"]')
      )
        .filter(
          element =>
            element.getAttribute('role') !== 'region' ||
            element.hasAttribute('data-lod-trace')
        )
        .map(rectangle)
        .filter(rect => rect.width > 0 && rect.height > 0);
      const routes = Array.from(
        host.querySelectorAll<SVGPathElement>('[data-lod-bundle]')
      ).map(path => {
        const matrix = path.getScreenCTM()!;
        const style = getComputedStyle(path);
        return {
          source:
            path.getAttribute('data-lod-bus-id') ??
            path.getAttribute('data-lod-bus-source')!,
          from: path.getAttribute('data-lod-bus-source'),
          to: path.getAttribute('data-lod-bus-target'),
          arrow: path.getAttribute('marker-end'),
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
      const smallText = Array.from(
        host.querySelectorAll(
          '[data-lod-controls] span, [data-lod-controls] p, [data-lod-controls] h2, [data-lod-controls] label, [data-lod-controls] select, [data-lod-controls] button, [data-lod-group] span'
        )
      )
        .filter(
          element =>
            visible(element) &&
            element.getBoundingClientRect().width > 0 &&
            Array.from(element.childNodes).some(
              child =>
                child.nodeType === Node.TEXT_NODE && child.textContent?.trim()
            )
        )
        .filter(element => parseFloat(getComputedStyle(element).fontSize) < 14)
        .map(element => ({
          text: element.textContent,
          size: getComputedStyle(element).fontSize,
        }));
      return {
        smallText,
        cards,
        controls,
        routes,
        accounting,
        coverage: {
          external: Number(host.getAttribute('data-external-relationships')),
          eligiblePairs: Number(host.getAttribute('data-external-pairs')),
          drawnPairs: Number(host.getAttribute('data-drawn-external-pairs')),
          deferred: Number(host.getAttribute('data-geometry-deferred')),
          summarized: Number(host.getAttribute('data-priority-summarized')),
          internal: Number(host.getAttribute('data-internal-relationships')),
          pending: Number(host.getAttribute('data-pending-relationships')),
          connectedDrawnGroups: new Set(
            routes.flatMap(route => [route.from, route.to])
          ).size,
          visibleGroups: cards.length,
        },
        bounds: {
          left: Math.max(0, bounds.left),
          right: Math.min(innerWidth, bounds.right),
          top: Math.max(0, bounds.top),
          bottom: Math.min(innerHeight, bounds.bottom),
        },
      };
    });
  await expect
    .poll(async () => (await read()).cards.length)
    .toBe(expectedCards);
  await expect
    .poll(async () => (await read()).routes.length)
    .toBeGreaterThan(0);
  const geometry = await read();
  expect(
    geometry.smallText,
    'Graph summaries and controls need readable text'
  ).toEqual([]);
  for (const trace of geometry.controls.filter(control => control.trace)) {
    for (const other of geometry.controls.filter(control => !control.trace)) {
      const overlaps =
        trace.x < other.x + other.width &&
        trace.x + trace.width > other.x &&
        trace.y < other.y + other.height &&
        trace.y + trace.height > other.y;
      expect(overlaps, 'Trace controls must clear other graph controls').toBe(
        false
      );
    }
  }
  for (const card of geometry.cards) {
    expect(card.visible, 'Schematic card must be visible').toBe(true);
    expect(
      card.width,
      'Schematic card must have visible width'
    ).toBeGreaterThan(0);
    expect(card.height).toBeGreaterThan(0);
    expect(card.titleSize).toBeGreaterThanOrEqual(18);
    expect(card.x).toBeGreaterThanOrEqual(geometry.bounds.left);
    expect(card.x + card.width).toBeLessThanOrEqual(geometry.bounds.right);
    expect(card.y).toBeGreaterThanOrEqual(geometry.bounds.top);
    expect(card.y + card.height).toBeLessThanOrEqual(geometry.bounds.bottom);
    for (const other of geometry.cards.filter(other => other.id !== card.id)) {
      const dx = Math.max(
        0,
        Math.max(card.x, other.x) -
          Math.min(card.x + card.width, other.x + other.width)
      );
      const dy = Math.max(
        0,
        Math.max(card.y, other.y) -
          Math.min(card.y + card.height, other.y + other.height)
      );
      expect(
        Math.hypot(dx, dy),
        'Cards need readable gutters'
      ).toBeGreaterThanOrEqual(63.9);
    }
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
    expect(route.arrow).toMatch(/^url\(#/);
    for (const [id, point] of [
      [route.from, route.points[0]],
      [route.to, route.points[route.points.length - 1]],
    ] as const) {
      const card = geometry.cards.find(card => card.id === id);
      expect(card).toBeTruthy();
      const boundaryDistance = Math.min(
        Math.abs(point.x - card!.x),
        Math.abs(point.x - card!.x - card!.width),
        Math.abs(point.y - card!.y),
        Math.abs(point.y - card!.y - card!.height)
      );
      expect(
        boundaryDistance,
        'Wire must meet its original endpoint card'
      ).toBeLessThan(0.01);
      expect(point.x).toBeGreaterThanOrEqual(card!.x - 0.01);
      expect(point.x).toBeLessThanOrEqual(card!.x + card!.width + 0.01);
      expect(point.y).toBeGreaterThanOrEqual(card!.y - 0.01);
      expect(point.y).toBeLessThanOrEqual(card!.y + card!.height + 0.01);
    }
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
  const clearance = measureSchematicClearance(
    [...geometry.cards, ...geometry.controls],
    geometry.routes.map((route, index) => ({
      id: String(index),
      bus: route.source,
      source: route.from!,
      target: route.to!,
      edgeIds: [],
      connections: [],
      points: route.points,
    }))
  );
  if (clearance.minCardClearance !== null)
    expect(
      clearance.minCardClearance,
      'Wires need room around cards and controls'
    ).toBeGreaterThanOrEqual(19.9);
  if (clearance.minUnrelatedWireClearance !== null)
    expect(
      clearance.minUnrelatedWireClearance,
      'Unrelated wires need distinct lanes'
    ).toBeGreaterThanOrEqual(15.9);
  const accounting = geometry.accounting?.match(
    /^(\d+) relationships, (\d+) not drawn:/
  );
  expect(accounting).toBeTruthy();
  expect(Number(accounting![1])).toBe(relationships);
  expect(
    geometry.routes.reduce((sum, route) => sum + route.count, 0) +
      Number(accounting![2])
  ).toBe(relationships);
  const drawn = geometry.routes.reduce((sum, route) => sum + route.count, 0);
  expect(
    drawn + geometry.coverage.deferred + geometry.coverage.summarized
  ).toBe(geometry.coverage.external);
  expect(
    geometry.coverage.external +
      geometry.coverage.internal +
      geometry.coverage.pending
  ).toBe(relationships);
  expect(geometry.coverage.drawnPairs).toBeGreaterThan(0);
  expect(geometry.coverage.drawnPairs).toBeLessThanOrEqual(
    geometry.coverage.eligiblePairs
  );
  expect(geometry.coverage.connectedDrawnGroups).toBeGreaterThanOrEqual(
    Math.min(2, expectedCards)
  );
  const geometryPath = info.outputPath(`${stage}-geometry.json`);
  writeFileSync(
    geometryPath,
    JSON.stringify({ ...geometry, metrics, clearance })
  );
  await info.attach(`${stage}-geometry.json`, {
    path: geometryPath,
    contentType: 'application/json',
  });
  const screenshotPath = info.outputPath(`${stage}.png`);
  await overview.screenshot({ path: screenshotPath });
  await info.attach(`${stage}.png`, {
    path: screenshotPath,
    contentType: 'image/png',
  });
}
