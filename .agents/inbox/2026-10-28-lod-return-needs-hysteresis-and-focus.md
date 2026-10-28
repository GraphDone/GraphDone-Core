# Restoring a LOD camera also requires its hysteresis and focus state

Observed 2026-10-28 UTC during independent review of nested LOD candidate
`43ada01ffeb213006289db5e20d3e36cebf2464c` for #215 / PR #216.
Existing renderer-ownership and title-refresh lessons were searched first; this
incident concerns history-dependent display cuts and focus after replacement.

## Dated evidence

The candidate passed 18 model cases, two strict real-browser journeys and
independent randomized conservation checks, but those did not exercise Auto
inspection return inside a hysteresis band or focused-parent replacement.

```text
2026-10-28
npm run test -w @graphdone/web -- src/components/SemanticGraphOverview.test.tsx
before correction: 4 failed, 1 passed
entry camera scale .4, original [System]
inspect at 1.2, Back at .4 -> [System/A, System/B]
focused System at .4, Auto zoom .46 -> document.activeElement BODY
live removal of focused summary -> BODY
entry overview at1.1, inspect1.2, Back1.1 -> summaries remain hidden
```

The actual desktop browser negative against the same application source restored
the exact entry camera but failed `2 groups · 72 items` after Auto Back: the cut
had expanded. Existing 5s assertion and 10s action limits remained unchanged.
Evidence is retained in `/tmp/graphdone-resolution-20261027/` as
`nested-review-all-unit-negative.log`, `nested-review-browser-negative.log` and
`nested-review-browser-negative-artifacts/`. Independent actual-component probe:
`/tmp/graphdone-review-nested-32eoo5dq/negative.log`.

After correction the focused component/model run passed 23/23; types passed.
The final frozen candidate and real-browser regression still require their own
strict validation and independent review in PR #216. A local probe is not
published acceptance evidence.

## Cause and corrective rule

The saved camera and manual cut omitted Auto's previous depth and overview
visibility. Hysteresis makes the same scale yield different states depending on
the path taken. Save both state machines at inspection entry and restore them
with the camera. Test both the nested-depth and overview-visibility bands.

Auto expansion removes the focused DOM button. Preserve an owned focus receipt
with canonical member IDs, then reconcile it to a surviving visible descendant
or ancestor (or the complete group list) when that element disappears. Do not
move focus when another control owns it. Test expand, collapse, live removal
and deliberate focus movement independently of mouse navigation.

## Limits

This restores view state only. It must not write source positions or turn summary
IDs into persisted nodes. Removed items cannot retain nonexistent representatives;
use an accessible fallback. It does not establish progressive loading, physical
phone performance, per-region spatial budgets or graph capacity. Carry the lesson
and regressions through normal review; do not equate this local note with a
completed integration.
