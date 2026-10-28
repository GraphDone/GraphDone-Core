# Priority controls must preserve current focus and inspection

2026-10-28, PR #224 / issue #220. Independent review of `5aaf6ec`
reproduced two interaction failures with the actual DOM/handlers:
- Open a “Blocks +2” pair, change Links to All and close the pair browser. The
  connected SVG trigger loses its tabindex, so calling focus does nothing and
  keyboard focus remains on BODY.
- Click the new Links control on a graph with fewer than40 items. The document
  outside-click handler clears the selected item and editing edge; the same
  control inside semantic overview is protected by that existing boundary.

Review evidence: PR comments4404185217 and4404202776, summary5687337487.
The initial helper/component suite passed41 cases and routing passed10; those
passes did not cover these transitions.

Corrective rule: after attempting return focus, verify the actual activeElement
and fall back to the visible Browse trigger if the original no longer accepts
focus. Preserve unrelated focus. A presentation control owns its click boundary;
changing detail must not also dismiss the current inspector/editor.

`relationship-priority.spec.ts` now opens a pair, switches to All, keyboard-closes
it and asserts Browse receives focus with an unchanged camera. It also inspects
Gateway, opens the native select by pointer, changes All/Essential by keyboard,
and checks the same inspector/camera remain. Both1440/390 headed journeys passed
in25.0s with one worker and zero retries (`priority-focus5`). Original identity,
API snapshot, explicit winner deletion/fallback and cleanup checks remain.
A preceding local command used the preview as its own copy source, failed the
copy, then executed the old tests; `priority-focus4` is not regression evidence.

Limits: local probes reuse owned dependencies. Full exact-head quality/browser
CI, actual2,000-item priority artifacts, independent correction review and final
dev integration remain required. No claim of full item routing/bus completion.

## Recompute label clearance when the browser panel changes

The `priority-count12` phone journey later failed its initial pair-return focus
assertion before any deletion. Independent trace inspection showed the pair
label was still present by ID but had `display:none`: a delayed label-placement
pass had treated the open relationship panel as an obstacle. Closing the panel
did not invalidate placement, so the now-unobstructed label stayed hidden and
focus correctly fell back to Browse. Review comment4404899816 records the trace
evidence; accepting Browse in this case would hide the layout defect.

A deterministic regression changes All then Essential while the phone panel is
open, verifies the obstructed label is hidden, then presses Escape. On the old
runtime `priority-obstacle14` failed after 16.23 seconds: the label remained hidden
for all 14 reads over the 5-second assertion deadline. Camera/data assertions and
expected focus remain unchanged.

The label-placement layout effect now also depends on `itemRelationshipScope`.
Mounting/unmounting/changing the panel recalculates its actual obstacle footprint
before the existing next-frame focus restoration. This is bounded placement on
a UI transition, not a new per-frame router. The All-level case still falls back
to Browse when the original label intentionally loses its interactive role.

The corrected `priority-obstacle15` run passed both full desktop/phone journeys
in 26.03 seconds with zero retries, including the deterministic hidden-to-visible
transition, original-label keyboard return, accurate post-delete counts and
computed typography negatives. The final priority CI still must validate and
retain these assertions on the published source.
