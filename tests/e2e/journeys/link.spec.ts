import { test, expect } from '@playwright/test';
import { backend, createItem, drawnEdges, enterWorkspace, linked, storedEdges } from '../../lib/journeys/workspace';
import { LINK_PATHS } from '../../lib/journeys/linkPaths';

/**
 * BASIC JOURNEY — connect two items. One test per way of doing it; run with
 * --repeat-each=N and the unified report turns the repeats into a success rate
 * with a 95% lower bound per path. Each trial starts from the real landing page
 * in a fresh browser, makes two items with the normal controls, connects them,
 * and checks what the person sees, what was saved, and that it survives reload.
 */
for (const path of LINK_PATHS) {
  test(`JOURNEY link ${path.id}: ${path.title} @journey`, async ({ page }, info) => {
    test.setTimeout(120000);
    test.skip(!!path.desktopOnly && !!info.project.use.hasTouch, 'keyboard-modifier gesture; touch devices have no Shift/Alt');
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));
    const run = `${info.repeatEachIndex}-${Date.now().toString(36)}`;
    const { graphId } = await enterWorkspace(page);
    const a = await createItem(page, `Plan ${run}`);
    const b = await createItem(page, `Do ${run}`);
    expect(linked(await storedEdges(page, graphId), a.id, b.id), 'the new items start unconnected').toBe(false);

    const started = Date.now();
    const friction = await path.run(page, a, b);
    info.annotations.push({ type: 'friction', description: JSON.stringify({ backend, ...friction }) });

    await expect.poll(async () => linked(await storedEdges(page, graphId), a.id, b.id),
      { message: 'the connection must be saved', timeout: 20000 }).toBe(true);
    info.annotations.push({ type: 'saved-after-ms', description: String(Date.now() - started) });
    const between = (await storedEdges(page, graphId)).filter(e => linked([e], a.id, b.id));
    expect(between, 'exactly one connection is saved').toHaveLength(1);
    await expect.poll(async () => linked(await drawnEdges(page), a.id, b.id),
      { message: 'the connection must be drawn', timeout: 5000 }).toBe(true);

    await page.reload();
    await expect.poll(async () => linked(await drawnEdges(page), a.id, b.id),
      { message: 'the connection must still be drawn after reload', timeout: 15000 }).toBe(true);
    expect(linked(await storedEdges(page, graphId), a.id, b.id), 'the connection must still be saved after reload').toBe(true);
    expect(errors, 'no page errors').toEqual([]);
  });
}
