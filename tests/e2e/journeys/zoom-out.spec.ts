import { test, expect, Page, TestInfo } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import { login, TEST_USERS } from '../../lib/auth';
import { gql } from '../../lib/graphRequest';
import { waitForStarterGraph } from '../../lib/seedGraph';
import { backend, openGraphView, SetupError } from '../../lib/journeys/workspace';
import { readableLabels } from '../../lib/journeys/readableLabels';

/**
 * JOURNEY zoom-out (#277): from the Welcome graph a new user starts on, zoom out
 * as far as the app allows. Every step must show readable text; the levels go
 * items → this graph's frame → the other graphs in its project → the projects,
 * never back; and a neighbouring graph opens with one click.
 *
 * The example project every new workspace gets supplies the hierarchy:
 *   Getting started: Welcome, Plan a launch, Fix bugs, Ideas
 *   Home: Move house
 */
const SIBLINGS = ['Plan a launch', 'Fix bugs', 'Ideas'];
const PROJECTS = ['Getting started', 'Home'];

type Step = { step: number; level: number; scale: number; labels: string[] };

/** Evidence goes to files in the test's output folder, so every reporter keeps it. */
async function evidence(info: TestInfo, name: string, body: string | Buffer, contentType: string) {
  const path = info.outputPath(name);
  await writeFile(path, body);
  await info.attach(name, { path, contentType });
}

/** The graph selector a person sees: the toolbar one, or the phone header's. */
const selector = (page: Page) => page.locator('[data-testid="graph-selector"]:visible, [data-testid="graph-selector-mobile"]:visible').first();

async function enterWelcome(page: Page) {
  if (backend === 'hosted-guest') {
    await page.goto('/');
    await page.getByRole('button', { name: /Continue as Guest/i }).first().click();
    await page.getByRole('dialog').getByRole('button', { name: /Continue as Guest/i }).click();
  } else {
    await login(page, TEST_USERS.ADMIN);
    await waitForStarterGraph(page);
    // The admin test user is shared, so pick the example project's Welcome
    // graph by its parent rather than trusting whichever graph was open last.
    const me = (await gql(page, '{ me { id } }')).me.id;
    const { graphs } = await gql(page, 'query($id: String!) { graphs(where: { createdBy: $id }) { id name parentGraphId } }', { id: me });
    const project = graphs.find((g: { name: string; parentGraphId: string | null }) => g.name === 'Getting started' && !g.parentGraphId);
    const welcome = project && graphs.find((g: { name: string; parentGraphId: string | null }) => g.name === 'Welcome' && g.parentGraphId === project.id);
    if (!welcome) throw new SetupError('the example project and its Welcome graph were not found');
    await page.evaluate(id => localStorage.setItem('currentGraphId', id), welcome.id);
    await page.goto('/');
  }
  await openGraphView(page);
  await expect(selector(page)).toContainText('Welcome', { timeout: 20000 })
    .catch(() => { throw new SetupError('the Welcome graph did not open'); });
  // The first screen is unchanged: the tutorial items, readable.
  await expect.poll(async () => (await readableLabels(page)).join(' '), { timeout: 20000 }).toContain('Welcome to');
}

async function camera(page: Page) {
  return page.evaluate(() => {
    const t = document.querySelector('svg g.main-graph-group')?.getAttribute('transform') ?? '';
    return Number(/scale\(([^)]+)\)/.exec(t)?.[1] ?? 1);
  });
}

async function settle(page: Page) {
  // Labels follow the camera on the next frames; give React and the 400 ms
  // frame refresh time to catch up.
  await page.waitForTimeout(600);
  const level = Number(await page.locator('.graph-container').first().getAttribute('data-zoom-level'));
  return { level, scale: await camera(page), labels: await readableLabels(page) };
}

test('JOURNEY zoom-out: every level is labelled, from items to projects', async ({ page }, info) => {
  test.setTimeout(240_000);
  const writes: string[] = [];
  await enterWelcome(page);
  const area = page.locator('.graph-container').first();
  const box = (await area.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  page.on('request', request => {
    const body = request.method() === 'POST' ? request.postData() ?? '' : '';
    if (request.url().includes('graphql') && /\bmutation\b/.test(body)) writes.push(body.slice(0, 120));
  });

  const steps: Step[] = [];
  const shots = new Set<number>();
  for (let step = 0; step < 30; step++) {
    if (step) await page.mouse.wheel(0, 250);
    const now = await settle(page);
    steps.push({ step, ...now });
    if (!shots.has(now.level)) {
      shots.add(now.level);
      await evidence(info, `zoom-out-level-${now.level}.png`, await page.screenshot(), 'image/png');
    }
    expect(now.labels, `step ${step} (level ${now.level}, zoom ${now.scale.toFixed(3)}) shows no readable text`).not.toEqual([]);
    const previous = steps[steps.length - 2];
    if (previous && previous.scale === now.scale && now.level === 3) break; // at the zoom limit
  }
  await evidence(info, 'zoom-out-steps.json', JSON.stringify(steps, null, 2), 'application/json');

  const levels = steps.map(s => s.level);
  for (let i = 1; i < levels.length; i++) expect(levels[i], `levels went back at step ${i}: ${levels.join(' ')}`).toBeGreaterThanOrEqual(levels[i - 1]);
  expect(levels[0]).toBe(0);
  expect(levels[levels.length - 1], `levels ${levels.join(' ')}`).toBe(3);
  // Each label starts with a graph or project name, then its counts.
  const seen = (level: number) => steps.filter(s => s.level === level).flatMap(s => s.labels);
  for (const name of ['Welcome', ...SIBLINGS])
    expect(seen(2).some(label => label.startsWith(`${name} `)), `"${name}" was not readable beside the graph: ${seen(2).join(' | ')}`).toBe(true);
  for (const name of PROJECTS)
    expect(seen(3).some(label => label.startsWith(`${name} `)), `project "${name}" was not readable: ${seen(3).join(' | ')}`).toBe(true);
  expect(writes, 'zooming saved something').toEqual([]);

  // Zoom back in until the neighbouring graphs show, without flicker on the way.
  let back = await settle(page);
  const backSteps = [back];
  // Wheel steps are smaller on high-density phone screens, so allow many.
  for (let i = 0; i < 40 && back.level !== 2; i++) {
    await page.mouse.wheel(0, -300);
    back = await settle(page);
    backSteps.push(back);
  }
  await evidence(info, 'zoom-back-steps.json', JSON.stringify(backSteps, null, 2), 'application/json');
  expect(back.level, 'zooming back in never showed the neighbouring graphs again').toBe(2);
  const wobble: number[] = [];
  for (const delta of [40, -40, 40, -40]) {
    await page.mouse.wheel(0, delta);
    wobble.push((await settle(page)).level);
  }
  expect(wobble, 'a small wobble changed the level').toEqual([2, 2, 2, 2]);

  // A neighbouring graph is a button: opening it switches graphs and frames
  // the new graph, so its own item titles are readable.
  const tile = page.getByRole('button', { name: /^Plan a launch graph, \d+ items?$/ });
  await expect(tile).toBeVisible();
  await tile.click();
  await expect(selector(page)).toContainText('Plan a launch', { timeout: 15000 });
  await expect.poll(async () => (await settle(page)).labels.join(' '), { timeout: 20000 }).toContain('Launch day');

  // Zooming in over a neighbouring graph opens it too, and the rest of that
  // wheel gesture must not leave the new graph off-centre and tiny.
  for (let i = 0; i < 40 && (await settle(page)).level < 2; i++) await page.mouse.wheel(0, 250);
  // Pick a neighbour whose tile is on screen (phones stack them above and below).
  const area2 = (await page.locator('.graph-container').first().boundingBox())!;
  let opened: { name: string; title: string; box: { x: number; y: number; width: number; height: number } } | undefined;
  for (const [name, title] of [['Fix bugs', 'Release the bug'], ['Ideas', 'Calendar sync'], ['Welcome', 'Welcome to']]) {
    const box = await page.getByRole('button', { name: new RegExp(`^${name} graph, \\d+ items?$`) }).boundingBox().catch(() => null);
    if (!box) continue;
    const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
    if (cx > area2.x + 20 && cx < area2.x + area2.width - 20 && cy > area2.y + 20 && cy < area2.y + area2.height - 20) { opened = { name, title, box }; break; }
  }
  expect(opened, 'no neighbouring graph tile was on screen around Plan a launch').toBeTruthy();
  const { name: next, title: nextTitle, box: target } = opened!;
  await page.mouse.move(target.x + target.width / 2, target.y + target.height / 2);
  for (let i = 0; i < 80 && !(await selector(page).textContent())?.includes(next); i++) {
    await page.mouse.wheel(0, -50);
    await page.waitForTimeout(60);
  }
  await expect(selector(page), `zooming in over "${next}" did not open it`).toContainText(next, { timeout: 15000 });
  // Keep scrolling a little, as a person does at the end of a gesture.
  for (let i = 0; i < 2; i++) await page.mouse.wheel(0, -50);
  await expect.poll(async () => (await settle(page)).labels.join(' '), { timeout: 20000 }).toContain(nextTitle);
  await evidence(info, 'zoom-in-opened.png', await page.screenshot(), 'image/png');
});
