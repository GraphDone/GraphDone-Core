# Trace fallback must respect direction and preserve useful screen space

Date:2026-10-28. Core PR224, issue220. Existing guidance on control flow,
readable symbols and priority context was checked first.

## Evidence and cause

Final source377f5a3 passed the small priority and2000-item/5000-edge stages, but
CI40751802514 failed both nested semantic browser cases. Retained review:
https://github.com/GraphDone/GraphDone-Core/pull/224#pullrequestreview-5688631798 .
Desktop incoming Payments selected an original DEPENDS_ON bundle, then wiring
intersected it with the global unordered-pair selection. The opposite-direction
BLOCKS winner removed the only eligible incoming relationship. The phone's
additional Links row reduced the measured overview capacity to one group.
The process-evidence failure is not a third independent failing browser case;
downstream required stages did not run.

The new component regression failed on the unchanged runtime: expected
`['fallback','reverse']`, received `['fallback']`;6 other cases passed.
Command, using an owned dependency fixture:
`vitest run src/components/SemanticGraphOverview.test.tsx --maxWorkers=1 --no-file-parallelism`.
After correction, that suite plus relationshipPriority and semanticTrace passed
19 cases in3.29s. A first command used a nonexistent vitest.config.ts and failed
before tests; it is not behavioral negative evidence.

A first responsive candidate passed both headed nested journeys in67.27s,
zero retries/errors, but its actual390px screenshot showed Zoom to Fit covering
part of the group-count button. That candidate is visually rejected despite
the green tests. The correction retains the reserved right control lane,
uses one line for the phone group/item counts, and reduces spacing without
reducing the14/16/18px typography floors or44px touch targets.

Final focused headed desktop/phone run passed2/2 in51.51s, zero retries,
errors or skipped cases, with the unchanged readable-text negative and strengthened
incoming-direction/control-clearance checks. Actual geometry JSON and PNGs show
two cards and one painted incoming route at both sizes: no card intersections,
unrelated crossings/overlaps, diagonal segments or small text. Partition at the
incoming trace is183 total =1 drawn +132 internal +50 external deferred; the
previously summarized incoming original is now represented in its explicit scope.
Command: `playwright test tests/e2e/graph/nested-semantic-lod.spec.ts
--project=GraphDone-Core/dev-neo4j/chromium --headed --workers=1 --retries=0
--trace=retain-on-failure --reporter=json`, against an owned local API/database.
The superseded67.27s candidate and full CI failures remain retained.

## Corrective rule

An explicit incoming/outgoing trace re-evaluates per-original-pair fallback
among that direction's canonical external relationships, before routing or
paging. Its additional eligible originals are represented while tracing;
other global originals remain accounted for. Exiting restores the global
priority partition. Do not switch the user's level to All, reverse originals,
or use the strongest group-level bundle to suppress other member pairs.

Maintain exact partitions for drawn, deferred, summarized, internal and pending
records. A component regression covers the opposite blocker, incoming fallback,
a lower-tier independent member pair, All, direction changes, exit and unchanged
input. The existing actual browser regression continues to require two useful
cards, a painted incoming dependency, readable text, clear routes and no writes.
It additionally checks top controls do not cover one another. Inspect screenshots;
a geometry oracle that checks only routes cannot establish control clearance.

## Limits

These changes concern group traces and controls, not arbitrary item obstacle
routing or larger browser capacity. Smaller screens can still honestly defer
content when finite space cannot fit two cards. A focused owned-fixture run is
not a clean-install/full-CI acceptance substitute. Earlier failures remain in
GitHub artifacts and final exact-source plus post-dev evidence is still required.
