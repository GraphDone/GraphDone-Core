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
  'new-user': { adapter: 'playwright', title: 'Headed new-user acceptance', args: [
    'tests/e2e/quality/new-user-modes.spec.ts',
    'tests/e2e/quality/button-content.spec.ts',
    'tests/e2e/graph/guest-dialog-layout.spec.ts',
    'tests/e2e/graph/responsive-real-workflows.spec.ts',
    'tests/e2e/graph/overview-board-actions.spec.ts',
    'tests/e2e/graph/recorded-ai-work.spec.ts',
    'tests/e2e/graph/admin-dialog-responsive.spec.ts',
    'tests/e2e/smoke/user-smoke.spec.ts',
    'tests/e2e/quality/persona-lifecycle.spec.ts',
    'tests/e2e/quality/graph-motion.spec.ts',
    'tests/e2e/quality/graph-resize.spec.ts',
    'tests/e2e/quality/graph-details.spec.ts',
    `--project=${PW}`, '--headed', '--workers=1', '--retries=0', '--trace=retain-on-failure',
  ], blocking: true },
  'agent-connection': { adapter: 'playwright', title: 'Agent connection and handoff acceptance', args: [
    'tests/e2e/quality/agent-collaboration.spec.ts', `--project=${PW}`, '--headed', '--workers=1', '--retries=0', '--trace=retain-on-failure',
  ], blocking: true },
  'inspector-readability': { adapter: 'playwright', title: 'Inspector readability acceptance', args: [
    'tests/e2e/graph/inspector-readability.spec.ts', `--project=${PW}`, '--headed', '--workers=1', '--retries=0', '--trace=retain-on-failure',
  ], blocking: true },
  'semantic-lod': { adapter: 'playwright', title: 'Semantic LOD acceptance', args: [
    'tests/e2e/graph/semantic-lod.spec.ts', `--project=${PW}`, '--headed', '--workers=1', '--retries=0', '--trace=retain-on-failure',
  ], blocking: true },
  'nested-lod': { adapter: 'playwright', title: 'Nested semantic LOD acceptance', args: [
    'tests/e2e/graph/nested-semantic-lod.spec.ts', `--project=${PW}`, '--headed', '--workers=1', '--retries=0', '--trace=retain-on-failure',
  ], blocking: true },
  'item-wires': { adapter: 'playwright', title: 'Item wire consumer acceptance', args: [
    'tests/e2e/graph/item-wire-consumers.spec.ts', 'tests/e2e/graph/item-symbols.spec.ts', 'tests/e2e/graph/relationship-priority.spec.ts', `--project=${PW}`, '--headed', '--workers=1', '--retries=0', '--trace=retain-on-failure',
  ], blocking: true },
  'large-symbols': { adapter: 'playwright', title: 'Two thousand item zoom acceptance', args: [
    'tests/e2e/graph/large-graph-symbols.spec.ts', `--project=${PW}`, '--workers=1', '--retries=0', '--trace=retain-on-failure',
  ], blocking: true },
  'schematic-visual': { adapter: 'playwright', title: 'Schematic fixture visual acceptance', args: [
    '--config=playwright.schematic.config.ts', '--workers=1', '--retries=0', '--trace=retain-on-failure',
  ], blocking: true },
  'layout-recovery': { adapter: 'playwright', title: 'Durable layout recovery acceptance', args: [
    'tests/e2e/graph/layout-recovery.spec.ts', `--project=${PW}`, '--headed', '--workers=1', '--retries=0', '--trace=retain-on-failure',
  ], blocking: true },
  'router-navigation': { adapter: 'playwright', title: 'Route compatibility acceptance', args: [
    'tests/e2e/auth/router-navigation.spec.ts', `--project=${PW}`, '--headed', '--workers=1', '--retries=0', '--trace=retain-on-failure',
  ], blocking: true },
  'e2e-auth': { adapter: 'playwright', title: 'Auth e2e — passwordless focus', args: ['tests/e2e/auth/passwordless-focus.spec.ts', `--project=${PW}`], blocking: true },
  'e2e-graph': { adapter: 'playwright', title: 'Graph e2e — camera', args: ['tests/e2e/graph/camera.spec.ts', `--project=${PW}`], blocking: true },
  'mobile': { adapter: 'playwright', title: 'Mobile audit', args: ['--grep', '@mobile|@audit', `--project=${PW}`, '--workers=1', '--retries=0', '--trace=retain-on-failure'], blocking: true },
  'perf-budgets': { adapter: 'playwright', title: 'Perf budgets (ADAPT-8)', args: ['tests/perf/graph-perf.spec.ts', '--project=perf', '--workers=1', '--retries=0', '--trace=retain-on-failure'], blocking: true },
  // Capture-heavy, report-only (own Playwright projects; specs under tests/e2e/reports/)
  'diagnostics': { adapter: 'playwright', title: 'Graph-geometry diagnostics', args: ['--project=geometry'], blocking: false },
  'showcase': { adapter: 'playwright', title: 'Showcase — video + screenshots', args: ['--project=showcase'], blocking: false },
  'matrix': { adapter: 'playwright', title: 'Feature × resolution matrix', args: ['--project=matrix'], blocking: false },
  'vlm': { adapter: 'playwright', title: 'Local-VLM visual eval (skips w/o endpoints)', args: ['--project=vlm'], blocking: false },
  'perf-scale': { adapter: 'playwright', title: 'Large-scale perf sweep', args: ['--project=perf-scale'], blocking: false },
  // LIVE Cloudflare site, from a guest user's point of view (desktop + phone),
  // recording .webm video + a labelled screenshot per step. Drives the real
  // production SPA — run with TEST_URL=https://graphdone-cloud.pages.dev.
  'live-journey': { adapter: 'playwright', title: 'Live site user journey (desktop + mobile)', args: ['--project=live-journey'], blocking: false },
  // Cross-repo: ingest the newest GraphDone-Cloud live-audit findings.json (sibling
  // repo) into the unified report. Skips cleanly when absent.
  'cloud-audit': { adapter: 'cloud-audit', title: 'Cloud live audit (ingested)', blocking: false },
};

export const PROFILES = {
  smoke: ['unit-web', 'smoke', 'e2e-auth'],
  pr: ['unit-web', 'smoke', 'e2e-auth', 'e2e-graph', 'agent-connection', 'inspector-readability', 'semantic-lod', 'nested-lod', 'item-wires', 'large-symbols', 'schematic-visual', 'layout-recovery', 'router-navigation', 'mobile', 'perf-budgets'],
  full: ['unit-web', 'smoke', 'e2e-auth', 'e2e-graph', 'agent-connection', 'inspector-readability', 'semantic-lod', 'nested-lod', 'item-wires', 'large-symbols', 'schematic-visual', 'layout-recovery', 'router-navigation', 'mobile', 'perf-budgets', 'diagnostics', 'showcase', 'matrix', 'vlm', 'perf-scale', 'cloud-audit'],
  report: ['diagnostics', 'showcase', 'matrix', 'vlm', 'perf-scale', 'cloud-audit'],
  live: ['live-journey'],
};
