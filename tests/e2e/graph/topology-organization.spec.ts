import { test as base, expect } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import { login, TEST_USERS } from '../../lib/auth';
import { gql } from '../../lib/graphRequest';
import { inspectItemSymbols } from '../../lib/itemSymbolVisual';
import {
  ownedGraphIdsFixture,
  type OwnedGraphs,
} from '../../lib/ownedGraphIdsFixture';

const test = base.extend<{ ownedGraphIds: OwnedGraphs }>({
  ownedGraphIds: [ownedGraphIdsFixture, { timeout: 60000 }],
});

test.use({ actionTimeout: 10000 });

for (const [width, height, size] of [
  [1440, 900, 9],
  [390, 844, 5],
])
  test(`central hubs organize into readable rings and survive reload at ${width}px @item-wires`, async ({
    page,
    ownedGraphIds,
  }, info) => {
    test.setTimeout(90000);
    await page.setViewportSize({ width, height });
    await login(page, TEST_USERS.ADMIN);
    const seeded = await ownedGraphIds.seed({
      size,
      spacing: 180,
      namePrefix: 'Topology hub',
      titleForIndex: i => (i === 0 ? 'System coordinator' : `Subsystem ${i}`),
      metadataForIndex: i => ({
        lod: { groupPath: [i === 0 ? 'Coordination' : `Subsystem ${i}`] },
      }),
    });
    await gql(
      page,
      'mutation($id:ID!){deleteEdges(where:{source:{graph:{id:$id}}}){nodesDeleted}}',
      { id: seeded.graphId }
    );
    const created = await gql(
      page,
      'mutation($input:[EdgeCreateInput!]!){createEdges(input:$input){edges{id}}}',
      {
        input: seeded.nodeIds.slice(1).map(id => ({
          type: 'BLOCKS',
          weight: 1,
          source: { connect: { where: { node: { id: seeded.nodeIds[0] } } } },
          target: { connect: { where: { node: { id } } } },
        })),
      }
    );
    const originalIds = created.createEdges.edges
      .map((e: { id: string }) => e.id)
      .sort();
    const snapshot = async () => {
      const result = await gql(
        page,
        'query($id:ID!){workItems(where:{graph:{id:$id}}){id title positionX positionY}edges(where:{source:{graph:{id:$id}}}){id type source{id}target{id}}}',
        { id: seeded.graphId }
      );
      result.workItems.sort((a: { id: string }, b: { id: string }) =>
        a.id.localeCompare(b.id)
      );
      result.edges.sort((a: { id: string }, b: { id: string }) =>
        a.id.localeCompare(b.id)
      );
      return result;
    };
    const before = await snapshot(),
      errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.evaluate(id => {
      localStorage.setItem('currentGraphId', id);
      localStorage.setItem('graphdone:viewMode', 'graph');
      localStorage.setItem('graphdone:layoutMode', 'hierarchical');
      localStorage.setItem('graphdone:relationship-priority', 'all');
    }, seeded.graphId);
    await page.goto('/');
    await expect(page.locator('.graph-container .node')).toHaveCount(size);
    await expect(
      page.getByRole('combobox', { name: 'Graph detail' })
    ).toHaveCount(0);
    const read = () =>
      page.locator('.graph-container').evaluate(host => ({
        cards: Array.from(host.querySelectorAll<SVGGElement>('.node')).map(
          element => {
            const node = (
              element as unknown as {
                __data__: { id: string; x: number; y: number };
              }
            ).__data__;
            const bounds = (
              element.querySelector('.node-bg') as SVGRectElement
            ).getBBox();
            return {
              id: node.id,
              painted: [
                element,
                ...Array.from(element.querySelectorAll('.node-title-text')),
              ].every(target => {
                for (
                  let current: Element | null = target;
                  current && current !== host;
                  current = current.parentElement
                ) {
                  const style = getComputedStyle(current);
                  if (
                    style.display === 'none' ||
                    style.visibility !== 'visible' ||
                    Number(style.opacity) < 0.99
                  )
                    return false;
                }
                return true;
              }),
              x: node.x,
              y: node.y,
              width: bounds.width,
              height: bounds.height,
              title: Array.from(element.querySelectorAll('.node-title-text'))
                .map(line => line.textContent)
                .join(' '),
              screen: (() => {
                const r = (
                  element.querySelector('.node-bg') as SVGRectElement
                ).getBoundingClientRect();
                return {
                  left: r.left,
                  right: r.right,
                  top: r.top,
                  bottom: r.bottom,
                };
              })(),
              screenWidth: (
                element.querySelector('.node-bg') as SVGRectElement
              ).getBoundingClientRect().width,
            };
          }
        ),
        edges: Array.from(
          host.querySelectorAll<SVGPathElement>('.edges-group .edge')
        ).map(element => {
          const edge = (
            element as unknown as {
              __data__: {
                id: string;
                source: { id: string };
                target: { id: string };
              };
            }
          ).__data__;
          const style = getComputedStyle(element);
          return {
            id: edge.id,
            source: edge.source.id,
            target: edge.target.id,
            painted:
              style.display !== 'none' &&
              style.stroke !== 'none' &&
              Number(style.opacity) > 0,
            length: element.getTotalLength(),
          };
        }),
        work: (window as unknown as { __graphOrganization?: unknown })
          .__graphOrganization,
      }));
    if (width >= 600) {
      await expect(page.getByTestId('mini-map-node')).toHaveCount(size);
      await page.waitForTimeout(4500);
      await page.evaluate(() => {
        const host = window as unknown as {
          updateMiniMapPositions: (
            positions: Record<string, { x: number; y: number }>
          ) => void;
          __organizedMiniMap?: Record<string, { x: number; y: number }>;
        };
        const update = host.updateMiniMapPositions;
        host.updateMiniMapPositions = positions => {
          host.__organizedMiniMap = positions;
          update(positions);
        };
      });
    }
    const crowded = await read();
    const beforePng = info.outputPath(`before-organization-${width}.png`);
    await page.screenshot({ path: beforePng });
    await info.attach('before-organization', {
      path: beforePng,
      contentType: 'image/png',
    });
    const button = page.getByRole('button', {
      name: 'Organize around connections',
      exact: true,
    });
    await expect(button).toBeEnabled();
    const target = await button.boundingBox();
    expect(target!.width).toBeGreaterThanOrEqual(44);
    expect(target!.height).toBeGreaterThanOrEqual(44);
    await button.click();
    expect(
      await page.evaluate(() => localStorage.getItem('graphdone:layoutMode'))
    ).toBe('force');
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            (
              window as unknown as {
                __layoutMetrics?: () => { atRest: boolean };
              }
            ).__layoutMetrics?.()?.atRest
        )
      )
      .toBe(true);
    await expect
      .poll(async () => {
        const geometry = await read(),
          hub = geometry.cards.find(card => card.id === seeded.nodeIds[0])!;
        const radii = geometry.cards
          .filter(card => card.id !== hub.id)
          .map(card => Math.hypot(card.x - hub.x, card.y - hub.y));
        return Math.max(...radii) - Math.min(...radii);
      })
      .toBeLessThan(0.01);
    await expect
      .poll(
        async () =>
          (await read()).cards.find(card => card.id === seeded.nodeIds[0])!
            .screenWidth
      )
      .toBeGreaterThanOrEqual(132);
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            (
              window as unknown as {
                __layoutMetrics?: () => { cameraReady: boolean };
              }
            ).__layoutMetrics?.()?.cameraReady
        )
      )
      .toBe(true);
    await expect(page.getByTestId('layout-save-status')).toContainText(
      'Layout saved to the server.',
      { timeout: 20000 }
    );
    await page.evaluate(
      () =>
        new Promise<void>(resolve =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
        )
    );
    const organized = await read();
    const checkReadability = async (
      scene: Awaited<ReturnType<typeof read>>
    ) => {
      const hub = scene.cards.find(card => card.id === seeded.nodeIds[0])!;
      expect(
        scene.cards.every(card => card.painted),
        'Cards and titles must actually be visible'
      ).toBe(true);
      expect(hub.screenWidth).toBeGreaterThanOrEqual(132);
      for (const card of scene.cards)
        expect(card.title).toBe(
          before.workItems.find((item: { id: string }) => item.id === card.id)
            .title
        );
      expect(
        Math.abs((hub.screen.left + hub.screen.right) / 2 - width / 2)
      ).toBeLessThan(48);
      const fullCards = scene.cards.filter(
        card =>
          card.screen.left >= 12 &&
          card.screen.right <= width - 12 &&
          card.screen.top >= 12 &&
          card.screen.bottom <= height - 12
      );
      expect(fullCards.length).toBe(size);
      const controls = await page
        .locator('[data-graph-fit-obstacle="true"]')
        .evaluateAll(elements =>
          elements.map(el => {
            const r = el.getBoundingClientRect();
            return {
              left: r.left,
              right: r.right,
              top: r.top,
              bottom: r.bottom,
            };
          })
        );
      for (const card of fullCards)
        for (const control of controls) {
          const dx = Math.max(
            0,
            control.left - card.screen.right,
            card.screen.left - control.right
          );
          const dy = Math.max(
            0,
            control.top - card.screen.bottom,
            card.screen.top - control.bottom
          );
          expect(
            Math.hypot(dx, dy),
            'Painted cards need a visible margin from controls'
          ).toBeGreaterThanOrEqual(11.9);
          expect(
            card.screen.left < control.right &&
              card.screen.right > control.left &&
              card.screen.top < control.bottom &&
              card.screen.bottom > control.top,
            'Visible organized cards must clear controls'
          ).toBe(false);
        }
      return hub;
    };
    const hub = await checkReadability(organized);
    let minimap: unknown;
    if (width >= 600) {
      await expect
        .poll(async () =>
          page.evaluate(cards => {
            const positions = (
              window as unknown as {
                __organizedMiniMap?: Record<string, { x: number; y: number }>;
              }
            ).__organizedMiniMap;
            return (
              !!positions &&
              cards.every(
                card =>
                  !!positions[card.id] &&
                  Math.abs(positions[card.id].x - card.x) < 0.01 &&
                  Math.abs(positions[card.id].y - card.y) < 0.01
              )
            );
          }, organized.cards)
        )
        .toBe(true);
      await expect(page.getByTestId('mini-map-node')).toHaveCount(size);
      minimap = await page.evaluate(
        () =>
          (window as unknown as { __organizedMiniMap?: unknown })
            .__organizedMiniMap
      );
    }
    const leaves = organized.cards.filter(card => card.id !== hub.id);
    expect(
      leaves.reduce((sum, card) => sum + card.x, 0) / leaves.length
    ).toBeCloseTo(hub.x, 2);
    expect(
      leaves.reduce((sum, card) => sum + card.y, 0) / leaves.length
    ).toBeCloseTo(hub.y, 2);
    for (const a of organized.cards)
      for (const b of organized.cards) {
        if (a.id === b.id) continue;
        const dx = Math.max(0, Math.abs(a.x - b.x) - (a.width + b.width) / 2),
          dy = Math.max(0, Math.abs(a.y - b.y) - (a.height + b.height) / 2);
        expect(
          Math.hypot(dx, dy),
          'Organized cards need room for wiring'
        ).toBeGreaterThanOrEqual(63.9);
      }
    expect(organized.edges.map(e => e.id).sort()).toEqual(originalIds);
    expect(
      organized.edges.every(
        e => e.painted && e.length > 1 && e.source === hub.id
      )
    ).toBe(true);
    await expect
      .poll(
        async () => {
          expect(
            (await read()).cards.find(card => card.id === seeded.nodeIds[0])!
              .screenWidth
          ).toBeGreaterThanOrEqual(132);
          const saved = await snapshot();
          return saved.workItems.every(
            (item: { id: string; positionX: number; positionY: number }) => {
              const card = organized.cards.find(card => card.id === item.id)!;
              return (
                Math.abs(item.positionX - card.x) < 1 &&
                Math.abs(item.positionY - card.y) < 1
              );
            }
          );
        },
        { timeout: 20000 }
      )
      .toBe(true);
    expect(
      (await read()).cards.find(card => card.id === seeded.nodeIds[0])!
        .screenWidth
    ).toBeGreaterThanOrEqual(132);
    const saved = await snapshot();
    expect(saved.edges).toEqual(before.edges);
    await page.evaluate(
      () =>
        new Promise<void>(resolve =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
        )
    );
    const png = info.outputPath(`organized-hub-${width}.png`);
    await page.screenshot({ path: png });
    await info.attach('organized-hub', { path: png, contentType: 'image/png' });
    await expect
      .poll(() =>
        page.evaluate(id => {
          const saved = JSON.parse(
            localStorage.getItem(`graphdone:camera:${id}`) || 'null'
          );
          const transform = (
            document.querySelector('.graph-container svg') as SVGSVGElement & {
              __zoom?: { x: number; y: number; k: number };
            }
          )?.__zoom;
          return (
            !!saved &&
            !!transform &&
            saved.manual === true &&
            Math.abs(saved.x - transform.x) < 0.01 &&
            Math.abs(saved.y - transform.y) < 0.01 &&
            Math.abs(saved.k - transform.k) < 0.001
          );
        }, seeded.graphId)
      )
      .toBe(true);
    await page.reload();
    await expect(page.locator('.graph-container .node')).toHaveCount(size);
    await expect(
      page.getByRole('combobox', { name: 'Graph detail' })
    ).toHaveCount(0);
    await expect
      .poll(async () => {
        const loaded = await read();
        return loaded.cards.every(card => {
          const previous = organized.cards.find(p => p.id === card.id)!;
          return (
            Math.abs(card.x - previous.x) < 0.01 &&
            Math.abs(card.y - previous.y) < 0.01
          );
        });
      })
      .toBe(true);
    expect((await snapshot()).edges).toEqual(before.edges);
    await expect
      .poll(
        async () =>
          (await read()).cards.find(card => card.id === hub.id)!.screenWidth
      )
      .toBeGreaterThanOrEqual(132);
    await expect
      .poll(() =>
        page.evaluate(() => {
          const metrics = (
            window as unknown as {
              __layoutMetrics?: () => {
                cameraReady: boolean;
                cameraFramed: boolean;
              };
            }
          ).__layoutMetrics?.();
          return metrics?.cameraReady && metrics?.cameraFramed;
        })
      )
      .toBe(true);
    await expect
      .poll(async () => (await read()).cards.every(card => card.painted))
      .toBe(true);
    await page.evaluate(
      () =>
        new Promise<void>(resolve =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
        )
    );
    const reloaded = await read();
    await checkReadability(reloaded);
    for (const card of reloaded.cards) {
      const previous = organized.cards.find(item => item.id === card.id)!;
      expect(card.screen.left).toBeCloseTo(previous.screen.left, 0);
      expect(card.screen.top).toBeCloseTo(previous.screen.top, 0);
      expect(card.screenWidth).toBeCloseTo(previous.screenWidth, 0);
    }
    const reloadedPng = info.outputPath(`organized-hub-reloaded-${width}.png`);
    await page.screenshot({ path: reloadedPng });
    await info.attach('organized-hub-reloaded', {
      path: reloadedPng,
      contentType: 'image/png',
    });
    expect(errors).toEqual([]);
    const receipt = info.outputPath(`organized-hub-${width}.json`);
    await writeFile(
      receipt,
      JSON.stringify({
        crowded,
        organized,
        saved,
        reloaded,
        minimap,
        errors,
      })
    );
    await info.attach('organized-hub', {
      path: receipt,
      contentType: 'application/json',
    });
  });

test('organizing after a low-zoom title edit retains and saves offscreen items @item-wires', async ({
  page,
  ownedGraphIds,
}, info) => {
  test.setTimeout(90000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await login(page, TEST_USERS.ADMIN);
  const seeded = await ownedGraphIds.seed({
    size: 2,
    spacing: 20000,
    namePrefix: 'Offscreen organization',
    titleForIndex: i => (i ? 'Far item' : 'Near item'),
  });
  for (const [index, id] of seeded.nodeIds.entries())
    await gql(
      page,
      'mutation($id:ID!,$x:Float!){updateWorkItems(where:{id:$id},update:{positionX:$x,positionY:100}){workItems{id}}}',
      { id, x: index ? 20000 : 1 }
    );
  await page.evaluate(id => {
    localStorage.setItem('currentGraphId', id);
    localStorage.setItem('graphdone:viewMode', 'graph');
    localStorage.setItem('graphdone:layoutMode', 'force');
  }, seeded.graphId);
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('/');
  await expect(page.locator('.graph-container .node')).toHaveCount(2);
  await page.evaluate(() =>
    (
      window as unknown as {
        miniMapZoom: (x: number, y: number, k: number) => void;
      }
    ).miniMapZoom(1, 100, 0.1)
  );
  const near = page
    .locator('.node')
    .filter({ has: page.locator(`[data-node-id="${seeded.nodeIds[0]}"]`) });
  await expect(near).toHaveAttribute('data-detail', 'compact');
  await expect(near).toHaveAttribute('role', 'button');
  await near.focus();
  await page.keyboard.press('Enter');
  await expect(
    page.getByRole('dialog', { name: 'Edit work item', exact: true })
  ).toBeVisible();
  await page.getByTestId('quick-title').fill('Edited near item');
  await page.getByTestId('quick-title').press('Enter');
  await expect(
    page
      .locator('.node-title-group > title')
      .filter({ hasText: 'Edited near item' })
  ).toHaveCount(1);
  await page
    .getByRole('button', { name: 'Close quick edit', exact: true })
    .click();
  await expect(page.locator('.graph-container .node')).toHaveCount(2);
  expect(
    await page.evaluate(
      () =>
        (
          window as unknown as { __layoutMetrics: () => { nodeCount: number } }
        ).__layoutMetrics().nodeCount
    )
  ).toBe(2);
  await page
    .getByRole('button', { name: 'Organize around connections', exact: true })
    .click();
  await expect
    .poll(
      async () => {
        const result = await gql(
          page,
          'query($id:ID!){workItems(where:{graph:{id:$id}}){id positionX positionY}edges(where:{source:{graph:{id:$id}}}){id source{id}target{id}}}',
          { id: seeded.graphId }
        );
        return result.workItems.every(
          (n: { positionX: number; positionY: number }) =>
            Math.abs(n.positionX) < 2000 && Math.abs(n.positionY) < 2000
        );
      },
      { timeout: 20000 }
    )
    .toBe(true);
  expect(errors).toEqual([]);
  const saved = await gql(
    page,
    'query($id:ID!){workItems(where:{graph:{id:$id}}){id positionX positionY}edges(where:{source:{graph:{id:$id}}}){id source{id}target{id}}}',
    { id: seeded.graphId }
  );
  expect(saved.workItems.map((item: { id: string }) => item.id).sort()).toEqual(
    [...seeded.nodeIds].sort()
  );
  expect(saved.edges).toHaveLength(seeded.edgeCount);
  expect(saved.edges[0].source.id).toBe(seeded.nodeIds[0]);
  expect(saved.edges[0].target.id).toBe(seeded.nodeIds[1]);
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (
            window as unknown as {
              __layoutMetrics: () => { cameraReady: boolean };
            }
          ).__layoutMetrics().cameraReady
      )
    )
    .toBe(true);
  const painted = await inspectItemSymbols(
    page,
    info,
    'offscreen-organization-painted'
  );
  expect(painted.cards.map(card => card.id).sort()).toEqual(
    [...seeded.nodeIds].sort()
  );
  expect(
    painted.cards.every(
      card => card.detail === 'full' && card.titles.length > 0
    )
  ).toBe(true);
  const receipt = info.outputPath('offscreen-organization.json');
  await writeFile(
    receipt,
    JSON.stringify({
      ids: seeded.nodeIds,
      saved,
      painted,
      metrics: await page.evaluate(() =>
        (
          window as unknown as { __layoutMetrics: () => unknown }
        ).__layoutMetrics()
      ),
      errors,
    })
  );
  await info.attach('offscreen-organization', {
    path: receipt,
    contentType: 'application/json',
  });
  const png = info.outputPath('offscreen-organization.png');
  await page.screenshot({ path: png });
  await info.attach('offscreen-organization', {
    path: png,
    contentType: 'image/png',
  });
});

test('fresh unplaced items wait for authoritative connections before automatic organization @item-wires', async ({
  page,
  ownedGraphIds,
}, info) => {
  test.setTimeout(90000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await login(page, TEST_USERS.ADMIN);
  const seeded = await ownedGraphIds.seed({
    size: 5,
    namePrefix: 'Fresh topology',
    titleForIndex: i => (i ? 'New subsystem ' + i : 'New system coordinator'),
  });
  await gql(
    page,
    'mutation($id:ID!){deleteEdges(where:{source:{graph:{id:$id}}}){nodesDeleted}updateWorkItems(where:{graph:{id:$id}},update:{positionX:0,positionY:0}){workItems{id}}}',
    { id: seeded.graphId }
  );
  const created = await gql(
    page,
    'mutation($input:[EdgeCreateInput!]!){createEdges(input:$input){edges{id}}}',
    {
      input: seeded.nodeIds.slice(1).map(id => ({
        type: 'BLOCKS',
        weight: 1,
        source: { connect: { where: { node: { id: seeded.nodeIds[0] } } } },
        target: { connect: { where: { node: { id } } } },
      })),
    }
  );
  const snapshot = () =>
    gql(
      page,
      'query($id:ID!){workItems(where:{graph:{id:$id}}){id positionX positionY}edges(where:{source:{graph:{id:$id}}}){id}}',
      { id: seeded.graphId }
    );
  let held = 0,
    release!: () => void;
  const gate = new Promise<void>(resolve => {
    release = resolve;
  });
  await page.route('**/api/graphql', async route => {
    const body = route.request().postDataJSON();
    if (
      body.operationName === 'GetEdges' &&
      JSON.stringify(body.variables).includes(seeded.graphId)
    ) {
      held++;
      await gate;
    }
    await route.continue();
  });
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  try {
    await page.evaluate(id => {
      localStorage.setItem('currentGraphId', id);
      localStorage.setItem('graphdone:viewMode', 'graph');
      localStorage.setItem('graphdone:layoutMode', 'force');
    }, seeded.graphId);
    await page.goto('/');
    await expect.poll(() => held).toBeGreaterThan(0);
    await expect(
      page.getByText('Loading graph data...', { exact: true })
    ).toBeVisible();
    await expect(page.locator('.graph-container .node')).toHaveCount(0);
    const pending = await snapshot();
    expect(
      pending.workItems.every(
        (n: { positionX: number; positionY: number }) =>
          n.positionX === 0 && n.positionY === 0
      )
    ).toBe(true);
    release();
    await expect(page.locator('.graph-container .node')).toHaveCount(5);
    await expect
      .poll(
        async () => {
          const saved = await snapshot(),
            hub = saved.workItems.find(
              (n: { id: string }) => n.id === seeded.nodeIds[0]
            );
          const leaves = saved.workItems.filter(
            (n: { id: string }) => n.id !== hub.id
          );
          const radii = leaves.map(
            (n: { positionX: number; positionY: number }) =>
              Math.hypot(
                n.positionX - hub.positionX,
                n.positionY - hub.positionY
              )
          );
          return (
            Math.min(...radii) > 200 &&
            Math.max(...radii) - Math.min(...radii) < 0.01
          );
        },
        { timeout: 20000 }
      )
      .toBe(true);
    const saved = await snapshot();
    expect(saved.edges.map((e: { id: string }) => e.id).sort()).toEqual(
      created.createEdges.edges.map((e: { id: string }) => e.id).sort()
    );
    expect(errors).toEqual([]);
    const receipt = info.outputPath('fresh-topology.json');
    await writeFile(receipt, JSON.stringify({ pending, saved, held, errors }));
    await info.attach('fresh-topology', {
      path: receipt,
      contentType: 'application/json',
    });
    const png = info.outputPath('fresh-topology.png');
    await page.screenshot({ path: png });
    await info.attach('fresh-topology', {
      path: png,
      contentType: 'image/png',
    });
  } finally {
    release();
    await page.unroute('**/api/graphql');
  }
});
