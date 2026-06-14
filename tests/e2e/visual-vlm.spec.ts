import { test, expect, Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { login, TEST_USERS } from '../helpers/auth';
import { seedLargeGraph, deleteGraphDeep } from '../helpers/seedGraph';
import '../helpers/testEnv';
import { isVlmAvailable, evaluateBatch, PERSONAS, personaByKey } from '../helpers/vlm';

/**
 * Local-VLM visual evaluation. Captures key user-facing states, then asks a
 * locally-hosted vision model to judge each one from four perspectives
 * (visual defects, new-user clarity, accessibility, living-graph aliveness).
 *
 * Report-only: it never fails on a model's subjective verdict — it writes
 * test-artifacts/vlm/results.json for `npm run report:vlm` and prints a
 * summary. It only asserts the VLM actually answered (so a broken client is
 * still caught). Skips entirely when no VLM endpoint is configured/reachable
 * (VLM_ENDPOINTS in .env.test.local), so CI stays green.
 */

const SHOT_DIR = path.resolve(process.cwd(), 'test-artifacts/vlm/shots');
const OUT = path.resolve(process.cwd(), 'test-artifacts/vlm/results.json');
const SCALE_DIR = path.resolve(process.cwd(), 'test-artifacts/scale-sweep');

interface Capture { file: string; context: string; personas: string[] }

async function shot(page: Page, name: string): Promise<string> {
  fs.mkdirSync(SHOT_DIR, { recursive: true });
  const file = path.join(SHOT_DIR, `${name}.png`);
  await page.screenshot({ path: file, fullPage: false }).catch(() => {});
  return file;
}

test('VLM visual evaluation across personas @vlm', async ({ page }) => {
  test.setTimeout(600_000);
  const available = await isVlmAvailable();
  test.skip(!available, 'No reachable VLM endpoint (set VLM_ENDPOINTS in .env.test.local)');

  const allPersonas = PERSONAS.map((p) => p.key);
  const captures: Capture[] = [];
  const cleanup: string[] = [];

  await login(page, TEST_USERS.ADMIN);
  await page.waitForTimeout(1500);

  // 1. Empty graph — first-run invitation (new-user + visual defects).
  const empty = await page.evaluate(async () => {
    const token = localStorage.getItem('authToken') ?? '';
    const post = (query: string, variables?: unknown) =>
      fetch('/api/graphql', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ query, variables }) }).then((r) => r.json());
    const me = await post('{ me { id } }');
    const g = await post(`mutation($i:[GraphCreateInput!]!){createGraphs(input:$i){graphs{id}}}`, { i: [{ name: `VLM Empty ${Date.now()}`, type: 'PROJECT', status: 'ACTIVE', createdBy: me.data.me.id, isShared: true }] });
    return g.data.createGraphs.graphs[0].id as string;
  });
  cleanup.push(empty);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.evaluate((id) => localStorage.setItem('currentGraphId', id), empty);
  await page.reload();
  await page.waitForTimeout(5000);
  captures.push({ file: await shot(page, 'empty-graph-desktop'), context: 'the first-run empty-state of a brand-new project graph in GraphDone, a graph-based task manager', personas: ['visual-defects', 'new-user', 'accessibility'] });

  // 2. Populated graph at ULTRA quality — full living-graph experience.
  const seeded = await seedLargeGraph(page, { size: 60, namePrefix: 'VLM' });
  cleanup.push(seeded.graphId);
  await page.evaluate((id) => { localStorage.setItem('currentGraphId', id); localStorage.setItem('graphdone.quality.override', 'ULTRA'); }, seeded.graphId);
  await page.reload();
  await page.waitForTimeout(8000); // let it settle + effects run
  captures.push({ file: await shot(page, 'populated-desktop'), context: 'a populated project graph (~60 work items) with dependency edges; nodes glow by priority and animate by status (in-progress breathes, blocked aches, complete settles)', personas: allPersonas });

  // 3. Same graph on a phone viewport — accessibility + new-user on mobile.
  await page.setViewportSize({ width: 393, height: 852 });
  await page.reload();
  await page.waitForTimeout(6000);
  captures.push({ file: await shot(page, 'populated-mobile'), context: 'the same project graph viewed on a phone-sized screen (393x852)', personas: ['visual-defects', 'new-user', 'accessibility'] });

  // 4. Bonus: judge any large-scale sweep screenshots for density/legibility.
  if (fs.existsSync(SCALE_DIR)) {
    for (const f of fs.readdirSync(SCALE_DIR).filter((f) => f.endsWith('.png'))) {
      const label = f.replace(/\.png$/, '');
      captures.push({ file: path.join(SCALE_DIR, f), context: `a large graph rendered at scale (${label}) — judge whether it stays legible at this density`, personas: ['visual-defects', 'accessibility'] });
    }
  }

  // Build and run the persona jobs.
  const jobs = captures.flatMap((c) =>
    c.personas
      .map((pk) => personaByKey(pk))
      .filter((p): p is NonNullable<typeof p> => Boolean(p))
      .map((persona) => ({ imagePath: c.file, persona, context: c.context, meta: { capture: path.basename(c.file) } }))
  );

  let results: Awaited<ReturnType<typeof evaluateBatch>> = [];
  try {
    results = await evaluateBatch(jobs);
  } finally {
    for (const id of cleanup) await deleteGraphDeep(page, id);
  }

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify({ generatedAt: new Date().toISOString(), results }, null, 2));

  const fails = results.filter((r) => !r.verdict.pass);
  // eslint-disable-next-line no-console
  console.log(`[vlm] ${results.length} evaluations, ${results.length - fails.length} pass, ${fails.length} flagged:`);
  for (const f of fails) {
    // eslint-disable-next-line no-console
    console.log(`  ⚠️ [${f.persona}] ${f.meta?.capture}: ${f.verdict.summary || f.verdict.issues.join('; ')}`);
  }

  // Report-only: we assert the VLM produced answers, not what it concluded.
  expect(results.length, 'VLM returned evaluations').toBeGreaterThan(0);
  const answered = results.filter((r) => !r.verdict.issues.some((i) => i.startsWith('VLM request failed') || i.startsWith('No reachable')));
  expect(answered.length, 'at least some VLM calls succeeded').toBeGreaterThan(0);
});
