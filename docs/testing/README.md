# Testing

GraphDone has one reproducible test entry — the **unified harness** — plus the
focused **smoke gate** that must pass before any "it works" claim.

```bash
TEST_URL=http://localhost:3127 npm run test:smoke   # THE GATE against a disposable stack
npm run test:unified                                # full battery → dual report
npm run test:unified:smoke                          # fast subset (unit + gate + a focused e2e)
npm run test:unified:open                            # full battery, then open the HTML report
npm run test:unified:lib                             # the harness's own unit tests (node --test)
```

Run from the repository root; the harness rejects a different working directory
so tests and source provenance cannot refer to different checkouts. Browser suites mutate data: use an owned disposable
local stack with test accounts and seeded data. `TEST_URL` selects an existing
stack; it does not make that stack disposable. `npm test` runs package unit tests,
not these browser workflows.

## Disposable production stack

With Node 22 dependencies, Chromium, Docker Compose, OpenSSL and Xvfb installed,
run from a clean committed checkout:

```sh
xvfb-run -a node scripts/test-production-stack.mjs --out test-artifacts/prod-stack
```

This builds the production API and nginx/web images, provisions a unique Compose
project with private generated credentials and certificates, and exposes only a
random loopback HTTPS port. It requires API/Neo4j health, authenticated owned
graph creation/readback, account identity across API recreation, all six existing
smoke cases (headed, one worker, zero retries/skips), and the separate SQLite
container persistence regression. It never uses an existing Neo4j instance or
the broad demo seed. Empty frontend URL build arguments select the application's
existing same-origin nginx proxy fallback for the randomly assigned port.

Each invocation creates a fresh `run-*` evidence directory with stage logs,
source fingerprints, image IDs, and a unified browser report. Certificates and
resolved Compose secrets stay in a private temporary directory. The runner
removes its containers, volumes and networks even on failure and verifies their
absence; local image tags remain available for cache/evidence. Nonzero stages,
timeouts, source changes and cleanup failures make the run fail. Raw failure
traces may include disposable credentials and request bodies; review them before
sharing. This validates an isolated local production stack, not a deployment or
multiarchitecture registry publication.

The shared browser auth helper accepts paired `TEST_ADMIN_USERNAME` and
`TEST_ADMIN_PASSWORD` overrides. Missing/empty halves fail; without overrides the
existing development credentials remain unchanged. The production runner supplies
its generated values automatically and does not print them.

## Dual output (one run, two artifacts)
The harness writes to `test-artifacts/unified/`:
- **`report.html`** — human-readable: per-sequence pass/warn/fail with embedded
  `<img>` screenshots and `<video>` `.webm` clips (from the showcase project),
  plus the cloud-audit summary. To share it, zip the whole folder (assets are
  referenced relatively).
- **`report.json`** — machine-parsable (`schema: graphdone.unified-report/1`):
  rollup status + totals + per-sequence counts. Per-sequence normalized JSON lands in
  `test-artifacts/unified/sequences/`.
- **exit code** is nonzero on execution/evidence failure; unknown profiles,
  sequences, missing option values, and unsafe output targets fail before tests
  run. Optional skipped reports exit zero with an explicit `skipped` status.

The adapters require actual case results and a successful process exit. Missing,
malformed, or empty reports cannot become passes. A nonzero exit, timeout, global
test error, or flaky retry fails even if some cases passed. Required sequences
also fail when cases are skipped. Explicitly optional report sequences may skip
when their prerequisites are absent; those cases never count as passing.
Supplied summary counters must be valid and agree with the individual results.
Vitest's legacy nonfailed total may include skipped/todo cases; the harness still
derives its passing count from assertions that actually passed.

On POSIX systems, each command owns a separate process group. A timeout sends
that group SIGTERM, allows a one-second grace period, then sends SIGKILL even if
the wrapper already closed. Output draining is limited to another 100 ms.
SIGINT/SIGTERM cancellation immediately stops all active owned command groups;
the runner exits with 130/143 unless a caller already owns signal handling.
Unrelated processes are never selected for cleanup. On Windows, only the direct
child is terminated; output draining is bounded but descendant cleanup is not
yet supported or validated. Process groups are not a sandbox: descendants that
deliberately create a new session/group can escape cleanup. OS-level stalls and
event-loop starvation can also delay timers. See the
[timeout incident and regressions](../quality/TEST_TIMEOUT_REVIEW_2026-10-23.md).

Reports include the starting/ending Git revision, dirty flag, and SHA-256 source
fingerprint. A source change during execution fails the run. Dirty trees are
identified rather than presented as clean commits. The fingerprint covers Git
HEAD, tracked changes, and nonignored untracked source; ignored build outputs,
external services, and deployed artifacts need separate identity checks. A local
passing report does not establish production parity or complete feature coverage.

Use a unique `--out test-artifacts/runs/<run-id>` for retained or parallel runs.
The default output slot remains compatible with the dashboard. A rerun can
refresh a harness-owned output directory without recursively deleting its
contents. Repository roots/ancestors, actual Git directories (including linked
worktree/common metadata and aliases), symbolic links inside report
directories, and nonempty unrelated output directories are rejected. The current
`report.json` identifies the cases and attachments belonging to that run; older
unreferenced artifacts may remain in a reused slot.

## How it's wired
- `tests/run-unified.mjs` — the entry. `--profile {smoke|pr|full|report}`,
  `--sequence <id>`, `--open`, `--out <dir>`, `--cloud-findings <path>`.
- `tests/sequences/unified.config.mjs` — declarative `SEQUENCES` + `PROFILES`.
  Each sequence names an adapter (`vitest` | `playwright` | `cloud-audit`) + inputs.
- `tests/lib/` — the reusable layer:
  - `reporting/` — `aggregate.mjs` (pure rollup, unit-tested), `html.mjs`, `json.mjs`,
    and the `generate-*-report.mjs` domain generators.
  - `adapters/` — `playwright.mjs` (parses PW JSON + harvests video/screenshots),
    `vitest.mjs`, `cloud-audit.mjs` (ingests the sibling GraphDone-Cloud live-audit).
  - `runner/runSequence.mjs`, plus the shared helpers (`auth.ts`, `api.ts`, …) and
    `metrics/balance_metrics.py`.

## Profiles
| profile | sequences | use |
| --- | --- | --- |
| `smoke` | unit-web, smoke gate, a focused auth e2e | fast blocking signal |
| `pr` | + graph e2e, mobile, perf budgets | broader PR signal; optional sequences remain identified |
| `full` | + diagnostics, showcase (video), matrix, vlm, perf-scale, cloud-audit | everything |
| `report` | the capture-heavy report sequences only | regenerate galleries |

The required performance and mobile sequences use one worker, zero test retries,
and the strict reporter in CI. Run them against an owned disposable stack with:

```bash
TEST_URL=http://localhost:3127 node tests/run-unified.mjs --sequence perf-budgets --out test-artifacts/runs/perf-check
TEST_URL=http://localhost:3127 node tests/run-unified.mjs --sequence mobile --out test-artifacts/runs/mobile-check
```

Strict `new-user`, `mobile`, and `perf-budgets` sequences retain traces on failure
even though retries are disabled. The adapter copies trace ZIPs and path-backed
JSON attachments into the run's report assets, with download links in HTML and
the dashboard, so the next Playwright invocation cannot erase that evidence.
These downloadable files must be regular files inside the repository's
`test-artifacts` directory, without symbolic links; unrelated source paths fail
the evidence check. The button-content
sweep labels each route/viewport step and attaches its navigation context plus
the latest 50 console warning/error, page-error, and failed-request events on
failure. In that custom JSON attachment, messages are capped at 1,000 characters;
request URL queries/fragments and common credential patterns are removed. That
JSON capture does not collect headers, request/response bodies, or browser
storage. Playwright trace ZIPs are separate, unsanitized evidence and can contain
raw network headers/bodies; keep raw traces with the disposable test artifacts,
and publish summaries rather than raw traces. The diagnostic capture preserves the original
failure and does not change assertion deadlines. See the
[static-shell evidence lesson](../../.agents/inbox/2026-10-23-browser-startup-evidence.md).

`perf-budgets` selects only the three cases in `tests/perf/graph-perf.spec.ts`.
Each creates its own four-node, three-edge placed graph and selects that graph
explicitly. Missing nodes, missing or stale metrics, skipped cases, and failed
HTTP/GraphQL responses fail the gate. Saved-snapshot checks compare rendered
world positions with the fixture and read the saved coordinates back from the
API. All 20 timed `workItems` responses must contain exactly the owned fixture
data before contributing to the latency result. This does not measure the MCP
`get_graph_context` operation.

Budgets remain 12 seconds to settle, alpha at most 0.02, average measured tick at
most 8 ms, saved-snapshot drift at most 25 world-coordinate pixels, and query p95
at most 800 ms. The existing conservative 20-sample percentile takes the largest
sample. This small placed graph does not establish large-graph, unplaced-layout,
or production performance; the separate scale sweep remains report-only.
Cleanup deletes owned edges before work items and the graph. If a stage fails or
its count is unconfirmed, cleanup fails and retains the remaining ownership path
for diagnosis rather than detaching children. See the
[evidence and instrumentation incident](../../.agents/inbox/2026-10-23-performance-gate-evidence.md).

## Test tree
- `tests/e2e/<domain>/` — `smoke` (THE GATE), `auth`, `graph`, `ui`, `a11y`,
  `mobile`, `responsive`, `api`, `admin`, and `reports/` (capture-heavy, own
  Playwright projects, excluded from the fast default project).
- `tests/diagnostics/<concern>/` — `layout`, `interactions`, `hierarchy`,
  `inspector`, `physics`, `perf`, `ui` (the `geometry` project; report-only).
- `tests/perf/` — ADAPT-8 budget gate + the large-scale sweep.
- `tests/integration/` — infra specs (TLS, installation), out of the default project.
- One canonical `playwright.config.ts` at the repo root.

## Adding tests
- **A new e2e spec:** drop it in the right `tests/e2e/<domain>/` folder; import
  helpers via `../../lib/<helper>` (depth-2). It's auto-collected by the default
  project (tag `@smoke`/`@core`/`@mobile` as appropriate).
- **A new harness sequence:** add an entry to `tests/sequences/unified.config.mjs`
  and list it in the relevant profile(s). Blocking sequences belong in `smoke`/`pr`.
- **The smoke gate** lives at `tests/e2e/smoke/user-smoke.spec.ts` — keep it the
  honest "a real user can use the app" check.

`tests/lib/adapters/execution-evidence.test.mjs` runs controlled child processes
that write passing, empty, malformed, skipped, and flaky reports before success,
failure, or timeout. `tests/lib/runner/unified-cli.test.mjs` uses disposable Git
repositories to check selection validation, output preservation, provenance, and
source-change rejection. These are harness regressions, not product acceptance.
`tests/lib/runner/runSequence.test.mjs` spawns real, disposable process trees to
check bounded timeouts, forced teardown, cancellation, and unrelated-process
preservation. POSIX-specific checks are explicitly skipped on Windows.

## Authentication in tests
Use the battle-tested helper for every authenticated spec:
```ts
import { login, navigateToWorkspace, TEST_USERS } from '../../lib/auth';
```

> Retired/legacy test files (and the previous `run-all-tests.js` / `run-pr-tests.js`
> runners these guides used to describe) are preserved under
> `archive/2026-06-test-cleanup/` with a MANIFEST — mine them before deleting.
