# Testing

GraphDone has one reproducible test entry — the **unified harness** — plus the
focused **smoke gate** that must pass before any "it works" claim.

```bash
TEST_URL=http://localhost:3127 npm run test:smoke   # THE GATE (blocking, ~30s)
npm run test:unified                                # full battery → dual report
npm run test:unified:smoke                          # fast subset (unit + gate + a focused e2e)
npm run test:unified:open                            # full battery, then open the HTML report
npm run test:unified:lib                             # the harness's own unit tests (node --test)
```

## Dual output (one run, two artifacts)
The harness writes to `test-artifacts/unified/`:
- **`report.html`** — human-readable: per-sequence pass/warn/fail with embedded
  `<img>` screenshots and `<video>` `.webm` clips (from the showcase project),
  plus the cloud-audit summary. To share it, zip the whole folder (assets are
  referenced relatively).
- **`report.json`** — machine-parsable (`schema: graphdone.unified-report/1`):
  rollup status + totals + per-sequence counts. Per-sequence raw JSON lands in
  `test-artifacts/unified/sequences/`.
- **exit code** = rollup status (any blocking failure → 1), so it doubles as a CI gate.

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
| `pr` | + graph e2e, mobile, perf budgets | broader blocking set for PRs |
| `full` | + diagnostics, showcase (video), matrix, vlm, perf-scale, cloud-audit | everything |
| `report` | the capture-heavy report sequences only | regenerate galleries |

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

## Authentication in tests
Use the battle-tested helper for every authenticated spec:
```ts
import { login, navigateToWorkspace, TEST_USERS } from '../../lib/auth';
```

> Retired/legacy test files (and the previous `run-all-tests.js` / `run-pr-tests.js`
> runners these guides used to describe) are preserved under
> `archive/2026-06-test-cleanup/` with a MANIFEST — mine them before deleting.
