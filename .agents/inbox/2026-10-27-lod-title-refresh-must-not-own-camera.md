# LOD title refresh must not interrupt the owning camera transition

Date: 2026-10-27. Issue #205. The symptom index already covered explicit camera
input cancelling automatic framing and renderer ownership; neither addressed an
overview-exit title refresh interrupting the active user animation.

## Evidence

CSS PR #199 CI run `40591493014` failed the desktop semantic-LOD case at camera
scale `1.1735656098434863` while expecting `1.2`. Its retained trace shows this
was after the test clock resumed; it was not an unadvanced-clock failure.

A new production-renderer regression starts at `1.1`, requests the existing
120 ms minimap zoom to `1.2`, and advances twelve 16 ms frames. It explicitly
observes overview exit above `1.15` before the target is reached. On the original
runtime, `npm run qc:lod -- --grep 1440 --trace=retain-on-failure` failed with
`1.1767031700493764` instead of `1.2`. The trace is retained under the owned
`/tmp/graphdone-resolution-20261027/lod-transition-negative-artifacts` directory.

The corrected runtime passes both 301-node/370-edge desktop and phone LOD
journeys in 3.3 minutes with one worker and zero retries. Existing membership,
label geometry, selected-item navigation, graph switching and zero-position-write
checks remain. Build, typecheck and lint pass (existing lint warnings remain);
web tests pass 346/346 and the harness passes 175/175. Exact-head review and CI
remain required before integration; source-only evidence is not a live deployment.

## Cause and corrective rule

The overview-exit effect reapplied the current camera through
`zoomBehavior.transform` to make formerly hidden title elements measurable.
D3's selection form of that API interrupts the selection's active transition.
Thus a presentation refresh cancelled the same animation that crossed the LOD
threshold, saving an intermediate camera position.

Refresh source-title geometry directly using the live camera scale after source
elements become visible. Scope the selection to the source `.main-group`, retain
the same-graph transition guard, and respect simplified rendering. Do not emit a
camera command merely to refresh presentation. Camera transitions belong to the
navigation operation that initiated them.

## Limits

This corrects overview-to-item transition ownership; it does not implement the
remaining multilevel grouping, bounded 1k rendering or progressive 10k loading
milestones. The browser regression uses owned synthetic graphs and preserves the
original interaction deadlines, required assertions and strict fixture cleanup.
