import { expect, type Page, type TestInfo } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import {
  measureSchematicClearance,
  measureSchematicClutter,
  schematicSegments,
} from '../../packages/web/src/lib/schematicRouting';

type OriginalEdge = {
  id: string;
  type: string;
  source: { id: string };
  target: { id: string };
};
type Snapshot = {
  focusId: string;
  cards: {
    id: string;
    kind: string;
    originalId?: string;
    members?: string[];
  }[];
  counts: Record<string, number>;
  partitionIds: Record<string, string[]>;
  routes: { source: string; target: string; edgeIds: string[] }[];
  routingDeferred: number;
  work: {
    candidates: number;
    maxCandidates: number;
    routing?: {
      attempts: number;
      maxAttempts: number;
      expandedStates: number;
      maxExpandedStates: number;
    };
  };
};
export async function readCanonicalItemPositions(page: Page) {
  return page.locator('.main-graph-group .node').evaluateAll(elements =>
    elements
      .map(element => {
        const data = (
          element as SVGGElement & {
            __data__: {
              id: string;
              x: number;
              y: number;
              fx: number | null;
              fy: number | null;
            };
          }
        ).__data__;
        if (!data?.id)
          throw new Error('Canonical item is missing its original D3 datum');
        return { id: data.id, x: data.x, y: data.y, fx: data.fx, fy: data.fy };
      })
      .sort((a, b) => a.id.localeCompare(b.id))
  );
}

export async function inspectLocalItemNeighborhood(
  page: Page,
  info: TestInfo,
  originals: readonly OriginalEdge[],
  stage: string,
  minimumNeighbors = 1
) {
  const layer = page.locator('.local-item-neighborhood[data-active="true"]');
  await expect(layer).toHaveCount(1);
  await expect
    .poll(() => layer.locator('[data-local-kind="item"]').count())
    .toBeGreaterThanOrEqual(minimumNeighbors + 1);
  const geometry = await layer.evaluate(host => {
    const painted = (element: Element) => {
      for (
        let current: Element | null = element;
        current;
        current = current.parentElement
      ) {
        const style = getComputedStyle(current);
        if (
          style.display === 'none' ||
          style.visibility !== 'visible' ||
          Number(style.opacity) <= 0
        )
          return false;
      }
      return true;
    };
    const rect = (element: Element) => {
      const r = element.getBoundingClientRect();
      return { x: r.x, y: r.y, width: r.width, height: r.height };
    };
    const cards = [
      ...host.querySelectorAll<HTMLElement>('[data-local-item-card]'),
    ].map(element => ({
      id: element.dataset.localItemCard!,
      kind: element.dataset.localKind!,
      originalId: element.dataset.originalItem,
      ...rect(element),
      painted: painted(element),
      titleSize: parseFloat(
        getComputedStyle(element.querySelector('[data-local-open]')!).fontSize
      ),
      titleWeight: Number(
        getComputedStyle(element.querySelector('[data-local-open]')!).fontWeight
      ),
    }));
    const controls = [
      ...document.querySelectorAll<HTMLElement>(
        '[data-graph-fit-obstacle="true"]'
      ),
    ]
      .filter(
        element =>
          element.getAttribute('role') !== 'region' &&
          painted(element) &&
          element.getBoundingClientRect().width > 0
      )
      .map((element, i) => ({ id: `control-${i}`, ...rect(element) }));
    const routes = [
      ...host.querySelectorAll<SVGPathElement>('[data-lod-bundle]'),
    ].map((path, i) => {
      const matrix = path.getScreenCTM()!;
      const style = getComputedStyle(path);
      return {
        id: String(i),
        bus: path.getAttribute('data-lod-bus-id')!,
        source: path.getAttribute('data-lod-bus-source')!,
        target: path.getAttribute('data-lod-bus-target')!,
        count: Number(path.getAttribute('data-count')),
        painted:
          painted(path) &&
          style.stroke !== 'none' &&
          Number(style.strokeOpacity) > 0 &&
          path.getTotalLength() > 0,
        width: parseFloat(style.strokeWidth),
        marker: path.getAttribute('marker-end'),
        points: (path.getAttribute('d')!.match(/[ML][^ML]+/g) ?? []).map(
          command => {
            const [x, y] = command.slice(1).split(',').map(Number);
            const point = new DOMPoint(x, y).matrixTransform(matrix);
            return { x: point.x, y: point.y };
          }
        ),
      };
    });
    const container = host.closest('.graph-container')!;
    const nativeInventory = Object.fromEntries(
      ['node', 'edge', 'edge-clickable', 'arrow', 'edge-label-group'].map(
        family => {
          const elements = [
            ...container.querySelectorAll(`.main-graph-group .${family}`),
          ];
          return [
            family,
            {
              total: elements.length,
              painted: elements.filter(painted).length,
            },
          ];
        }
      )
    );
    const native = Object.values(nativeInventory).reduce(
      (sum, family) => sum + family.painted,
      0
    );
    const snapshot = (window as unknown as { __localItemLOD: Snapshot })
      .__localItemLOD;
    const bounds = container.getBoundingClientRect();
    return {
      cards,
      controls,
      routes,
      native,
      nativeInventory,
      snapshot,
      bounds: {
        x: bounds.x,
        y: bounds.y,
        width: bounds.width,
        height: bounds.height,
      },
    };
  });
  expect(
    geometry.native,
    'Replaced native cards, wires and input targets must stay hidden'
  ).toBe(0);
  for (const [family, inventory] of Object.entries(geometry.nativeInventory))
    expect(
      inventory.total,
      `Loaded native ${family} inventory must be present`
    ).toBeGreaterThan(0);
  expect(geometry.cards.length).toBeLessThanOrEqual(7);
  for (const card of geometry.cards) {
    expect(card.painted, 'Local cards must actually be painted').toBe(true);
    expect(card.titleSize).toBeGreaterThanOrEqual(18);
    expect(card.titleWeight).toBeGreaterThanOrEqual(600);
    expect(card.x).toBeGreaterThanOrEqual(geometry.bounds.x + 19.8);
    expect(card.y).toBeGreaterThanOrEqual(geometry.bounds.y + 19.8);
    expect(card.x + card.width).toBeLessThanOrEqual(
      geometry.bounds.x + geometry.bounds.width - 19.8
    );
    expect(card.y + card.height).toBeLessThanOrEqual(
      geometry.bounds.y + geometry.bounds.height - 19.8
    );
    for (const other of [
      ...geometry.cards.filter(value => value.id !== card.id),
      ...geometry.controls,
    ]) {
      const dx = Math.max(
          0,
          other.x - card.x - card.width,
          card.x - other.x - other.width
        ),
        dy = Math.max(
          0,
          other.y - card.y - card.height,
          card.y - other.y - other.height
        );
      expect(
        Math.hypot(dx, dy),
        'Local cards need readable card/control margins'
      ).toBeGreaterThanOrEqual(
        geometry.cards.some(value => value.id === other.id) ? 63.8 : 19.8
      );
    }
  }
  expect(
    geometry.routes.length,
    'The focused view must draw useful connections'
  ).toBeGreaterThan(0);
  for (const route of geometry.routes) {
    expect(route.painted, 'Local wire must actually be painted').toBe(true);
    expect(route.width).toBeGreaterThanOrEqual(3);
    expect(route.count).toBeGreaterThan(0);
    expect(route.marker).toMatch(/^url\(#/);
    for (const [id, point] of [
      [route.source, route.points[0]],
      [route.target, route.points.at(-1)!],
    ] as const) {
      const card = geometry.cards.find(value => value.id === id)!;
      expect(card, 'Every local route must end on a painted card').toBeTruthy();
      const distance = Math.min(
        Math.abs(point.x - card.x),
        Math.abs(point.x - card.x - card.width),
        Math.abs(point.y - card.y),
        Math.abs(point.y - card.y - card.height)
      );
      expect(distance).toBeLessThan(0.1);
      expect(point.x).toBeGreaterThanOrEqual(card.x - 0.1);
      expect(point.x).toBeLessThanOrEqual(card.x + card.width + 0.1);
      expect(point.y).toBeGreaterThanOrEqual(card.y - 0.1);
      expect(point.y).toBeLessThanOrEqual(card.y + card.height + 0.1);
    }
  }
  const metrics = measureSchematicClutter(
    [...geometry.cards, ...geometry.controls],
    geometry.routes.flatMap(route => schematicSegments(route.points, route.bus))
  );
  expect(metrics.cardIntersections).toBe(0);
  expect(metrics.unrelatedCrossings).toBe(0);
  expect(metrics.unrelatedOverlaps).toBe(0);
  expect(metrics.diagonalSegments).toBe(0);
  const clearance = measureSchematicClearance(
    [...geometry.cards, ...geometry.controls],
    geometry.routes.map(route => ({ ...route, edgeIds: [], connections: [] }))
  );
  if (clearance.minCardClearance !== null)
    expect(clearance.minCardClearance).toBeGreaterThanOrEqual(19.8);
  if (clearance.minUnrelatedWireClearance !== null)
    expect(clearance.minUnrelatedWireClearance).toBeGreaterThanOrEqual(15.8);
  const incident = originals.filter(
    edge =>
      edge.source.id === geometry.snapshot.focusId ||
      edge.target.id === geometry.snapshot.focusId
  );
  const partitionIds = Object.values(geometry.snapshot.partitionIds).flat();
  expect(new Set(partitionIds).size).toBe(partitionIds.length);
  expect([...partitionIds].sort()).toEqual(
    incident.map(edge => edge.id).sort()
  );
  const originalsById = new Map(originals.map(edge => [edge.id, edge]));
  const drawnIds = geometry.snapshot.routes.flatMap(route => route.edgeIds);
  expect(new Set(drawnIds).size).toBe(drawnIds.length);
  const members = (id: string) => {
    const card = geometry.snapshot.cards.find(value => value.id === id)!;
    return card.originalId ? [card.originalId] : (card.members ?? []);
  };
  for (const route of geometry.snapshot.routes)
    for (const id of route.edgeIds) {
      const edge = originalsById.get(id)!;
      expect(members(route.source)).toContain(edge.source.id);
      expect(members(route.target)).toContain(edge.target.id);
    }
  expect(drawnIds.length + geometry.snapshot.routingDeferred).toBe(
    geometry.snapshot.partitionIds.representedCandidates.length
  );
  expect(geometry.routes.reduce((sum, route) => sum + route.count, 0)).toBe(
    drawnIds.length
  );
  expect(geometry.snapshot.work.candidates).toBeLessThanOrEqual(
    geometry.snapshot.work.maxCandidates
  );
  const work = geometry.snapshot.work.routing!;
  expect(work.attempts).toBeLessThanOrEqual(work.maxAttempts);
  expect(work.expandedStates).toBeLessThanOrEqual(work.maxExpandedStates);
  const file = info.outputPath(`${stage}.json`);
  await writeFile(file, JSON.stringify({ ...geometry, metrics, clearance }));
  await info.attach(stage, { path: file, contentType: 'application/json' });
  const png = info.outputPath(`${stage}.png`);
  await page.screenshot({ path: png });
  await info.attach(stage, { path: png, contentType: 'image/png' });
  return { ...geometry, metrics, clearance };
}
