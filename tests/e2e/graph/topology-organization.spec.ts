import { test as base, expect } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import { login, TEST_USERS } from '../../lib/auth';
import { gql } from '../../lib/graphRequest';
import {
  ownedGraphIdsFixture,
  type OwnedGraphs,
} from '../../lib/ownedGraphIdsFixture';

const test = base.extend<{ ownedGraphIds: OwnedGraphs }>({
  ownedGraphIds: [ownedGraphIdsFixture, { timeout: 60000 }],
});

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
      localStorage.setItem('graphdone:layoutMode', 'force');
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
              x: node.x,
              y: node.y,
              width: bounds.width,
              height: bounds.height,
              title: Array.from(element.querySelectorAll('.node-title-text'))
                .map(line => line.textContent)
                .join(' '),
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
    const organized = await read();
    const hub = organized.cards.find(card => card.id === seeded.nodeIds[0])!;
    expect(hub.screenWidth).toBeGreaterThanOrEqual(132);
    for (const card of organized.cards)
      expect(card.title).toBe(
        before.workItems.find((item: { id: string }) => item.id === card.id)
          .title
      );
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
    expect(errors).toEqual([]);
    const receipt = info.outputPath(`organized-hub-${width}.json`);
    await writeFile(
      receipt,
      JSON.stringify({
        crowded,
        organized,
        saved,
        reloaded: await read(),
        errors,
      })
    );
    await info.attach('organized-hub', {
      path: receipt,
      contentType: 'application/json',
    });
  });
