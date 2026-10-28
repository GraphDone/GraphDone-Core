# Keep conservative label geometry when hidden SVG measurement is empty

2026-10-28 UTC, independent review of item-wire source
`d9a0a5855612290b7c765999440b0d1d55b36333` for #220 / PR #221. Existing
guidance was searched in the symptom index and the offset-label lesson. This
was a source-review finding, not a reproduced deployed/browser incident.

The first placement pass can hide an edge-label group before its delayed
150ms sizing callback runs. Accepting an empty `getBBox()` then replaces a
conservative text estimate with padding alone (36 units), allowing a long
label to be admitted using an undersized obstacle/background. Initialize text,
icon and background from one conservative cache, and replace that cache only
when both measured dimensions are positive. Hidden labels must not become
small merely because they are not currently measurable.

The same review found a line-only diagnostic reading `x1.baseVal` after the
renderer changed to SVG paths. Read actual path endpoints through
`getPointAtLength` and transform them through `getScreenCTM`. Searching for
remaining `SVGLineElement` / `x1.baseVal` consumers found this one diagnostic.

A separate source audit found that directed perpendicular offsets put reverse
edges on the same lane: reversing both the direction and lane sign cancels the
separation. Use a canonical unordered endpoint direction to define lane sides,
while preserving the original route direction for arrows and editing.

Dated local commands used supported Node22.18, nice10, one worker, in the
existing clean-installed partial probe (not full-tree acceptance):

```sh
node node_modules/vitest/vitest.mjs run --root packages/web \
  src/lib/__tests__/edgeRouteGeometry.test.ts --maxWorkers=1 --no-file-parallelism
node node_modules/typescript/bin/tsc --noEmit -p packages/web/tsconfig.json
node node_modules/@playwright/test/cli.js test tests/e2e/graph/item-wire-consumers.spec.ts --list
node --test --test-concurrency=1 tests/lib/runner/unified-cli.test.mjs
```

Results: 11 geometry cases passed in0.722s (9ms bodies); scoped web types passed
in3.72s; two browser cases discovered, **not executed locally**; 32 CLI harness
cases passed in4.56s without a browser. Scoped flat-config lint over both
components/helper/test passed with0 errors and314 warnings. An initial lint
invocation from the uninstalled worktree failed to resolve a legacy config;
the corrected command ran from the probe's web package with
`ESLINT_USE_FLAT_CONFIG=true`. That setup error is not a source lint result.

The new blocking `item-wires` sequence is enrolled in PR/full profiles and CI
after smoke, before longer suites, with one browser worker and zero retries.
It exercises actual SVG paint/hitboxes/arrows, pointer dragging, wire/label
editing and initially hidden label sizing, retains PNG/JSON, rejects writes,
compares original graph data and uses owned fixture cleanup. CI execution and
artifact review remain required. The route is still straight; these changes
do not establish bounded obstacle routing, visible detail budgets, complete
spaghetti detection or closure of #220.
