/**
 * Declarative manifest for the unified test harness (tests/run-unified.mjs).
 * Each sequence names an adapter + its inputs; PROFILES select which run.
 * Paths reflect the CURRENT tree (Phase 0 of the test-tree refactor is
 * non-destructive); they update as specs move into domain folders.
 *
 * Profiles:
 *   smoke  — fast blocking signal (unit + THE GATE + a focused e2e)
 *   pr     — broader blocking set for PRs (adds graph + mobile)
 *   full   — everything incl. report-only capture sequences (video/screenshots)
 *   report — only the capture-heavy report sequences
 */
const PW = 'GraphDone-Core/dev-neo4j/chromium';

export const SEQUENCES = {
  'unit-web': { adapter: 'vitest', title: 'Web unit tests', cwd: 'packages/web', blocking: true },
  'smoke': { adapter: 'playwright', title: 'Smoke gate (THE GATE)', args: ['tests/e2e/smoke/user-smoke.spec.ts', `--project=${PW}`], blocking: true },
  'e2e-auth': { adapter: 'playwright', title: 'Auth e2e — passwordless focus', args: ['tests/e2e/auth/passwordless-focus.spec.ts', `--project=${PW}`], blocking: true },
  'e2e-graph': { adapter: 'playwright', title: 'Graph e2e — camera', args: ['tests/e2e/graph/camera.spec.ts', `--project=${PW}`], blocking: true },
  'mobile': { adapter: 'playwright', title: 'Mobile audit', args: ['--grep', '@mobile|@audit', `--project=${PW}`], blocking: false },
  'showcase': { adapter: 'playwright', title: 'Showcase — video + screenshots', args: ['--project=showcase'], blocking: false },
};

export const PROFILES = {
  smoke: ['unit-web', 'smoke', 'e2e-auth'],
  pr: ['unit-web', 'smoke', 'e2e-auth', 'e2e-graph', 'mobile'],
  full: ['unit-web', 'smoke', 'e2e-auth', 'e2e-graph', 'mobile', 'showcase'],
  report: ['showcase'],
};
