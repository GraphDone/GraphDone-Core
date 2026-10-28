# Graph controls need shared flow and explicit event boundaries

2026-10-28, PR #223 / issue #222. CI 40731080444 tested merge
`7eb3b6085282c53b5a48ce806bd1e35bf21424c8` from source `b33febb`.
Its durable-layout report contains four actual passes and five actual failures,
plus the execution-failure record. All five failures show the connection Browse
button intercepting pointer clicks intended for layout Retry/Discard controls.
The independently verified smoke artifact SHA-256 is
`c52d20e7` (prefix; complete digest retained in the GitHub artifact metadata).
Screenshots and traces are retained in the failed run. Four downstream browser
stages were skipped; this run is not acceptance.

Cause: status and connection controls independently occupied bottom-left space
at the same z-index. Increasing text size exposed an existing ownership problem.
A second headed regression at 1440/390 opened the relationship browser's Edit
button, but the parent document outside-click handler immediately cleared the
selected edge, changing the new dialog into Create relationship.

Corrective rule: put status, trace and connection controls in one responsive,
scrollable flow dock in both item and group views. Include each control's actual
footprint in routing/label obstacles. Do not fix overlapping controls by changing
paint order or forcing test clicks. Keep browser-panel clicks inside its event
boundary so opening an editor cannot also trigger outside dismissal.

Validation commands use one headed Chrome, one worker and zero retries:
- `playwright test item-wire-consumers.spec.ts layout-recovery.spec.ts --grep
  'item wire paths|reload|unavailable storage'`: three passed in 36.7s. Exact
  browser Edit now checks original source, target and type without data writes.
- `playwright test layout-recovery.spec.ts --grep
  'quota-failed|retry after real|pending layout keeps'`: three passed in 42.2s.
  The pending-layout journey also checks disjoint status/Connections bounds,
  normal Retry/Browse/Discard clicks at 1440 and 390px, and actual API/receipt
  state. Existing durability and camera assertions remain unchanged.
- Web `tsc --noEmit` passed using the owned dependency fixture. This is scoped
  evidence, not a pinned clean-install or complete CI result.

Limits: the dock reserves control space, not arbitrary card-to-overlay clearance.
Full exact-source CI, actual artifact review and final dev checks remain required.
The separate priority feature has additional desktop/phone browser coverage;
its success does not establish this PR's full acceptance.

The first phone trace run rejected the dock container as overlapping its own
trace child. The transparent layout container no longer declares itself as a
second obstacle; status, trace and connection controls each retain their actual
measured obstacle. The oracle and its overlap assertions are unchanged. The
failed `dock-trace-phone1` artifacts are retained.
The corrected phone hierarchy/trace journey passed in 25.3s in
`dock-trace-phone2`, including its original overlap/readability checks and the
8px trace-text negative. No oracle assertion was relaxed.

Independent review of `fe84973` used the actual dock/status components and the
production D3 zoom filter. A wheel over status prevented native scrolling and
changed camera scale from 1 to 0.8705505633. Marking the shared dock with the
existing `data-lod-controls` boundary leaves the wheel default intact and scale
at 1. The pending-layout browser case now adds a 390×500 viewport, requires
actual dock overflow, wheels over its status area, and verifies native scrolling
with an unchanged camera before discarding the owned receipt.
The complete amended pending-layout journey passed in 15.7s on 2026-10-28,
with one headed Chrome, one worker and zero retries (`dock-native-scroll1`).
