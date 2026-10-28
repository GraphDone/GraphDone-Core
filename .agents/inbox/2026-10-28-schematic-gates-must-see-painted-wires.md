# Schematic acceptance must see painted wires, not only clean coordinates

Observed 2026-10-28 UTC in independent source review of
`41127f064f6f755b357dcbdbcd0761f3143fafea`. The symptom index and prior display
ownership/bus-budget lessons were searched before recording this incident.

## Evidence and cause

```text
2026-10-28 source review
git show 41127f0:tests/lib/schematicOverview.ts
  required two card elements and at least one path
  checked intersections and represented/not-drawn accounting
  did not require positive visible card bounds or actual wire paint

git show 41127f0:tests/e2e/graph/nested-semantic-lod.spec.ts
  button name /Request delivery/ matched both the member control
  and the new aria-label="Relationships of <same title>" control

Correction 41b8a03c4c08b750c501e9cbcedf52086e2ed0c4
  independent exact-source review: no remaining findings
  no local browser execution; actual extended CI remained pending
```

These were source-review findings, not claimed browser reproductions. A hidden
diagram can have zero clutter, and new adjacent controls can make a formerly
unique accessible-name substring ambiguous. Screenshot attachments alone do
not cause automated acceptance to fail.

## Corrective rule

Require visible card bounds inside the viewport and painted paths, including
ancestor display/visibility/opacity, stroke paint, width and nonzero path length.
Retain positive route/count requirements and geometric clutter checks. An
intentional opacity-zero wire in the real CI journey must trigger the named
visibility assertion, then be restored in `finally`. Verify actual original
source/target port placement and arrows when incoming buses are introduced.

Select the member inspection control by its actual visible title, while testing
the adjacent relationship control independently. Keep strict locators; do not
silence the ambiguity with an arbitrary `.first()`.
The existing semantic overview journey's 38-member count needs the same visible
text distinction: relationship buttons include the item title in their accessible
name. Keep the expected 38 source members, and count the actual member controls.

## Limits

These checks detect a basic class of visual regression. They do not establish
pleasant spacing, meaningful system grouping, full item/path routing or scale.
Inspect the retained screenshots and exact-source CI reports. Under the owner's
workstation constraint, use small serial local tests and remote browser gates;
discovery-only evidence is never a passing browser journey.

## Exact control names and exported evidence

Actual CI 40633460829 at source88d0115 / tested merge025288dafa5fcbefb282fc2c5a313a58dcddebd2
passed static visual4, smoke6, new-user42 and semantic-LOD2. Both nested cases then
failed at `getByLabel('Relationship type', { exact: true }).selectOption('BLOCKS')`;
the strict sequence correctly failed with its process-exit evidence. Screenshots
showed the control present. The installed Playwright label selector reads the
wrapping label's descendant text, including select options. Explicit accessible
names now keep type, direction and depth labels stable. The exact selectors,
10-second actions and zero retries remain unchanged. Thirteen scoped relationship
component cases passed in 5.48s; corrected browser execution remains required.

The same artifact exposed an evidence-export gap: the unified Playwright adapter
imports path attachments, while the new tests used body-only PNG/JSON attachments.
Those did not appear in the normal passing report's attachment list. New producers
write owned output files and attach paths, with distinct overview/outgoing/incoming
names. Inspect the next actual report for all pictures/geometry, not just success
counts or images buried inside a failure trace. The adapter's accepted file boundary
is unchanged. Earlier artifacts and failures are retained.
