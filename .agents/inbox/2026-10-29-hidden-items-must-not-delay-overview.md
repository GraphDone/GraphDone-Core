# Hidden item rendering must not delay the visible overview

## Evidence — 2026-10-29 UTC

Actual post-merge `dev` revision `17acc25dc98978c64f87a5b0d6fb36b1833cdfa7`
failed the unchanged five-second browser zoom guard in
[CI run 40812241527](https://github.com/GraphDone/GraphDone-Core/actions/runs/40812241527).
The [retained smoke artifact](https://github.com/GraphDone/GraphDone-Core/actions/runs/40812241527/artifacts/12870958655)
contains `test-artifacts/ci-large-symbols/report.json` and its `large-symbols`
assets: `9.json` (detail zoom), `12.json` (overview zoom), `15.zip` (trace).
Recover with `gh run download 40812241527 --repo GraphDone/GraphDone-Core --name smoke-results-17acc25dc98978c64f87a5b0d6fb36b1833cdfa7`.

The real 2,000-item / 5,000-edge case loaded in 27,088 ms. Its detail zoom took
3,745.5 ms and overview zoom took 5,119.1 ms against `< 5,000 ms`. The case failed
at 125,186 ms, below its 240-second total timeout. The new bus-inspection journey
had completed in 45,516 ms. Only four of thirteen strict reports ran; the later
zoom, final snapshot, no-write and error guards were not reached. Comprehensive
Tests run 40812241568 passed, which does not replace this failed browser guard.

## Cause and working hypothesis

`InteractiveGraphVisualization` clears item culling below scale 0.5, then the
zoom-end callback rebuilds item titles/metadata and forces original-edge routing
and label work. Its source groups are CSS-hidden while semantic overview owns
the display. That control flow is verified; the exact share of the 5,119 ms
attributable to hidden work is not yet measured. Previous pre-merge success is
not evidence that the actual integration passed.

## Corrective rule

Let the visible presentation own expensive rendering. Skip hidden item graphics
and coalesce terminal camera work, while preserving source simulation, canonical
selection, layout and camera ownership. Refresh actual cards and relationships
when returning to Items, including manual Items selection with no camera event.
Keep the five-second zoom and 45-second load guards and retain the original
failure. Validate correctness with small serial controls locally; measure the
real 2k journey and all final guards on hosted exact-revision CI.

## Limits and tracking

This is issue [#235](https://github.com/GraphDone/GraphDone-Core/issues/235), linked
to #231/#193. It does not claim to fix placement/routing spacing (#220/#233/#234),
change source layout ownership, or establish a timing improvement before new
measurements. Initial failed-run fingerprint:
`34c6cda2542943a3e65e610b3c92dd9f94e0f837e7f418f42f3dcb8a617337b5`.

## Correction and local controls — 2026-10-29 UTC

`useItemPresentation` coalesces terminal zoom work into one animation frame after
React commits the active presentation. Overview activation/deactivation is
reported in layout effects. Hidden source culling, item opacity and original-edge
routing/label work are skipped. Source simulation and camera ownership are
unchanged; the geometry scale still follows the terminal camera. Returning to
Items clears the item presentation cache and refreshes current cards, opacity,
culling and routes before paint, including manual Items without a camera event.
The scheduler cancels detached work and checks the current simulation.

Local commands, run serially with Node 22 and one Vitest worker:

- `npm run test --workspace=@graphdone/web -- --maxWorkers=1 src/hooks/useItemPresentation.test.tsx src/components/SemanticGraphOverview.test.tsx src/components/OverviewBusLayer.test.tsx src/lib/overviewBusHit.test.ts`: **16 passed / 4.86 s**.
- `npm run typecheck --workspace=@graphdone/web`: passed. The first local check
  caught a D3 selection union on chained `attr`; individual attribute writes
  corrected it before publication.
- Scoped ESLint on both presentation components and the new hook/test: **0 errors**,
  302 existing-style warnings in the large graph component.
- Playwright discovery finds the existing three 301-item desktop/phone and 2k
  cases. No local browser or large fixture was launched.

Two retained local negative controls establish the regressions: replacing the
hidden branch with unconditional item rendering fails two tests (hidden work
appears); suppressing the Items-return refresh also fails two tests (the displayed
card remains at scale 1.2/revision 0 instead of scale 0.2/revision 1). Corrected
source passes both. The hook test includes the actual `SemanticGraphOverview`
mode selector and automatic exit, and asserts current SVG text/path plus visible
host ownership. This small control is not a full-application timing measurement.

Existing browser journeys now capture actual item-presentation pass/scale
attributes, require zero item passes during the 2k overview zoom, and check real
cards and paths after manual Items selection. These are additional assertions,
not substituted readiness or timing gates. Hosted exact-source acceptance and
independent review remain required before claiming the performance issue solved.

## Review correction: route before restoring arrow paint

Author self-audit and the independent reviewer identified a return-order problem
in the initial implementation (`968e956`). Arrows created during hidden overview
start at opacity zero. Applying opacity before publishing routes filters those
arrows out; newly represented priority edges have the same problem. A small
D3/JSDOM probe extracted the actual `updateZoomPresentation` callback and used
actual `edgeLOD` functions: old order retained opacity **0**, while route-first
produced opacity **1** at scale 1.2. This is a demonstrated rendering defect, not
a timing inference. The return now establishes routes before restoring opacity.
The existing desktop/phone journey additionally changes priority while hidden,
returns through the actual Items selector, and records/asserts current arrow
transforms and full opacity. Its JSON and screenshots are retained. Fresh final
source CI is required; the earlier `968e956` run is not final acceptance.
