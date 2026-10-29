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
