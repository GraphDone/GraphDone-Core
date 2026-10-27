# Delayed autofocus must preserve focus already chosen by the user

On 2026-10-27, CAPTCHA PR #195 [CI 40579557476](https://github.com/GraphDone/GraphDone-Core/actions/runs/40579557476)
failed `LARGE-01` because the status-note Add button remained disabled. Its
retained trace shows the note input focused at 746363ms, then the note text
appended to the title at 746402ms. The note input stayed empty. Token PR #197
[CI 40580018905](https://github.com/GraphDone/GraphDone-Core/actions/runs/40580018905)
also retained a `TEAM-01` disabled-Add failure before the overall new-user
process reached its 900-second limit. Its incomplete JSON report establishes
no passing cases. Related incident: [#200](https://github.com/GraphDone/GraphDone-Core/issues/200).

## Cause and corrective rule

`useModalA11y` defers initial focus until an animation frame so a portaled
dialog can mount. That callback unconditionally selected the first form field,
even when someone had already selected the status-note input. Delayed initial
focus must yield to a field already focused in the dialog and to deliberate
focus changes outside it. It may move focus when the opening trigger is still
focused or focus has fallen back to the body. A detached dialog must not take
focus. Existing keyboard trapping, cancellation and close behavior remain.

## Regression and evidence

Using Node 22.18.0/npm 10.8.2 in the owned `core-editor-focus-20261027`
worktree, `npm test --workspace @graphdone/web --
src/components/QuickEditSurface.test.tsx` ran the actual portaled surface and
node editor with a controlled animation-frame queue. Against dev
`97dc8849db8f257ffa88ab790c4452a8022eeaa6`, both chosen-focus cases failed
and four initial-focus/keyboard/cleanup controls passed. With the hook guard,
all six passed. The note case asserts the title stays intact and the only
commit is note metadata. No sleeps, retries, longer timeouts or focus-wait
workarounds were added to the application flow.

Initial lint rejected the DOM `FrameRequestCallback` type under the existing
no-undef configuration; the fixture uses an explicit local callback type.
Final browser, build, types, lint, full web-unit and harness evidence belongs
in the PR discussion. Retain the failed CI and negative-control results.

## Limits

The deterministic test controls frame order in jsdom; actual persona browser
workflows separately cover persistence and desktop/phone interaction. This
does not add background inertness, change the existing Tab trap contract,
prove hosted parity, or turn interrupted CI evidence into a pass. Private
traces can contain authentication state and must not be copied into the repo.
