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
