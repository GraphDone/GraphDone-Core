/**
 * Declarative manifest for the unified test harness (tests/run-unified.mjs).
 * Each sequence names an adapter + its inputs; PROFILES select which run.
 *
 * Profiles:
 *   smoke  — fast blocking signal (unit + THE GATE + a focused e2e)
 *   pr     — broader blocking set for PRs (adds graph, mobile, perf budgets)
 *   full   — everything incl. the capture-heavy, report-only sequences
 *   report — only the capture-heavy report sequences (video / galleries / metrics)
 */
const PW = 'GraphDone-Core/dev-neo4j/chromium';

export const SEQUENCES = {
  // Blocking signal
  'unit-web': { adapter: 'vitest', title: 'Web unit tests', cwd: 'packages/web', blocking: true },
  'smoke': { adapter: 'playwright', title: 'Smoke gate (THE GATE)', args: ['tests/e2e/smoke/user-smoke.spec.ts', `--project=${PW}`], blocking: true },
  'e2e-auth': { adapter: 'playwright', title: 'Auth e2e — passwordless focus', args: ['tests/e2e/auth/passwordless-focus.spec.ts', `--project=${PW}`], blocking: true },
  'e2e-graph': { adapter: 'playwright', title: 'Graph e2e — camera', args: ['tests/e2e/graph/camera.spec.ts', `--project=${PW}`], blocking: true },
  'mobile': { adapter: 'playwright', title: 'Mobile audit', args: ['--grep', '@mobile|@audit', `--project=${PW}`], blocking: false },
  'perf-budgets': { adapter: 'playwright', title: 'Perf budgets (ADAPT-8)', args: ['--project=perf'], blocking: false },
  // Capture-heavy, report-only (own Playwright projects; specs under tests/e2e/reports/)
  'diagnostics': { adapter: 'playwright', title: 'Graph-geometry diagnostics', args: ['--project=geometry'], blocking: false },
  'showcase': { adapter: 'playwright', title: 'Showcase — video + screenshots', args: ['--project=showcase'], blocking: false },
  'matrix': { adapter: 'playwright', title: 'Feature × resolution matrix', args: ['--project=matrix'], blocking: false },
  'vlm': { adapter: 'playwright', title: 'Local-VLM visual eval (skips w/o endpoints)', args: ['--project=vlm'], blocking: false },
  'perf-scale': { adapter: 'playwright', title: 'Large-scale perf sweep', args: ['--project=perf-scale'], blocking: false },
};

export const PROFILES = {
  smoke: ['unit-web', 'smoke', 'e2e-auth'],
  pr: ['unit-web', 'smoke', 'e2e-auth', 'e2e-graph', 'mobile', 'perf-budgets'],
  full: ['unit-web', 'smoke', 'e2e-auth', 'e2e-graph', 'mobile', 'perf-budgets', 'diagnostics', 'showcase', 'matrix', 'vlm', 'perf-scale'],
  report: ['diagnostics', 'showcase', 'matrix', 'vlm', 'perf-scale'],
};
