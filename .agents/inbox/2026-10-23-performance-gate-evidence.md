# Required performance gates must measure owned data and publish short-lived simulations

Date: 2026-10-23. Searched `docs/testing/README.md`, `tests/README.md`, the
unified manifest, prior responsive acceptance lessons, and performance specs.
Tracking: public issue #156.

The three-case performance suite selected existing/default graphs, skipped empty
graphs and missing drift metrics, and timed a `workItems` query without checking
HTTP status, GraphQL errors, or returned data. Its name incorrectly claimed to
measure `get_graph_context`. Both performance and mobile were declared optional
in the unified manifest even though CI required them using raw Playwright exits.

Before correction, `node --test tests/lib/runner/unified-cli.test.mjs` failed the
three new regression cases: both required sequences accepted a successful child
process reporting only skipped cases, and their manifest selection was optional
with retries inherited from CI. After correction on combined base `33b3016`,
`npm run test:unified:lib` passed 151/151 tests, including bad metric/data samples
and staged cleanup failure controls. The exact public head `4a4a11f`, rebased
without functional changes onto `5f0f454`, passed 150/150: that base excludes an
unrelated minimatch harness regression. Actual Playwright `--list` collected
3 performance and 27 mobile cases.
Commands ran on Node 22.23.4; regression logs are retained under
`/tmp/core-perf-gate-{red,lib-final}.log` in the audit environment.

The corrected three browser cases create four owned placed nodes and three edges,
assert their rendered identities and saved positions, and require real metrics.
On unchanged application `aece6797ef61b21665c924762fb8c9ff68870c3a`, this command
used the owned localhost stack, bundled Chromium, and no test retries:

```text
TEST_URL=http://127.0.0.1:13127 QC_API_URL=http://127.0.0.1:14127/graphql \
xvfb-run --auto-servernum npx playwright test tests/perf/graph-perf.spec.ts \
  --project=perf --headed --workers=1 --retries=0 --trace=on
2 failed, 1 passed (49.9s); 0 skipped
Both failures: PerfMeter must publish metrics for the fixture
```

The fixture, rendered nodes/edges, and saved-coordinate setup assertions passed.
All 20 exact-data API latency samples passed, and all fixtures were cleaned.
The failed traces and JSON/log are retained in the owned performance worktree's
ignored `test-artifacts/audit-20261023/perf-initial*` outputs.

Cause: the first publication waited until `performance.now() > 2000`, while a
fully placed simulation can end after its first real tick before that threshold.
Unplaced simulations can also stop between periodic reports, leaving stale
pre-settlement metrics. The correction publishes the first real measured tick
and a terminal snapshot, rejects inactive/wrong-graph simulations and zero
samples, and clears old metrics when stopping/replacing/emptying the simulation.
The browser gate also requires the matching graph ID and terminal snapshot.

Post-fix validation used the same three cases at exact test revision `4a4a11f`
against clean combined application `b009245035559fccadd350a02c106b6da42347c6`:

```text
Same headed command, one worker, zero retries: 3 passed (33.9s); 0 skipped
Both metric cases: 4 nodes, 3 edges, 1 actual tick sample, alpha 0, settled true
Average measured tick: 0.2 ms; measured saved-snapshot drift: 0 px
20 successful exact-data PerfWorkItems responses: p95 13.7 ms
```

Each snapshot carried its own matching graph ID. The saved-position case also
compared all four live world positions with the known fixture coordinates and
verified unchanged persisted coordinates through the API. All fixture cleanup
stages passed. JSON attachments, traces, and logs are retained alongside the
negative control as `perf-final*`; the public PR records the review and outcome.
Fresh owned `npm ci --legacy-peer-deps`, core build, 275/275 web tests, and web
typecheck passed on the scoped public head. Initial checks using an incomplete
dependency link failed to resolve nested AJV; subsequent checks used this
branch's pinned dependencies and built workspace types.

Corrective rule: required suites must fail on missing evidence, use owned
deterministic fixtures, verify every timed response, and identify the operation
actually measured. A measured zero differs from no samples. Keep existing
budgets. Preserve parent relationships if child cleanup fails, so the fixture
remains identifiable; independent review caught and corrected best-effort
cleanup that could have detached surviving children.

Limits: passing the small placed fixture cannot establish large-graph or unplaced
layout performance, MCP latency, distributed service capacity, or deployed-site
health. One measured pinned tick is not a frame-rate benchmark (the meter's FPS
is zero because there is no inter-frame interval). The combined application and
test revisions above identify the browser evidence; final integrated acceptance
and public merge validation remain separate gates.
