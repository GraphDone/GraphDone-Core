# Project dragged labels onto their displayed offset path

2026-10-28 UTC, detailed item-wiring preparation for #220. Existing guidance
was searched through `.agents/issues/INDEX.md`, `edgeLabelLayout.ts` and the
schematic lessons. This is a controlled helper regression found before D3
integration, not an observed failure in a deployed item router.

The independent review of `eee4063c43e619a33c48fd0408bb9dc2dd45cc92` asked for
an offset-label drag case beside a close return wire. The helper initially
projected the pointer onto the wire centerline. On a U-shaped route whose
horizontal legs are 40 units apart, the lower leg's upright label is offset22
units upward. Its center is18 units from the upper wire and22 from its own.
Nearest-wire projection therefore selects the wrong leg even with the prior
fraction available as a tie-breaker: the distances are not tied.

Command, supported Node22.18, existing clean-installed partial probe, one worker:

```sh
node node_modules/vitest/vitest.mjs run --root packages/web \
  src/lib/__tests__/edgeRouteGeometry.test.ts --maxWorkers=1 --no-file-parallelism
```

Before correction: 9 passed, 1 failed, exit1, 0.713s. The executed new assertion
expected `340 / 440 = 0.772727...` but received `100 / 440 = 0.227272...`.
It passed a requested offset22 while the earlier helper ignored that extra
argument. The production API was then extended explicitly, not the assertion
relaxed. After correction: 10 passed, no skips, exit0, 0.691s (8ms test bodies).
Scoped strict ES2020 TypeScript checking of helper and test also passed. Source
and test were copied unchanged into the probe; this is not full-tree acceptance.

Corrective rule: use the same upright perpendicular displacement for pointer
projection and label painting. At D3 drag start, retain where inside the label
the pointer grabbed it, then project the adjusted label center onto the offset
route. Preserve icon rotation around the icon's own center. Keep the direct
wire projection available for wire hit testing; it has different geometry.

The review also found repeated route scans and candidate sorting in placement.
Interpolate each candidate directly on its current segment and retain the best
candidate in one pass. Placement now has O(segments × obstacles + segments)
work with at most four candidates per segment. Runtime callers still need
explicit bounds and a suitable update cadence. A null sampled placement means
no tested slot was clear, not that every mathematical position is obstructed.

The regression lives in `edgeRouteGeometry.test.ts`. No browser/database/image
suite ran locally, no canonical positions changed, and no item-renderer
acceptance is claimed. Carry this finding with the D3 consumer fix and its
actual pointer/browser gates through normal review.
