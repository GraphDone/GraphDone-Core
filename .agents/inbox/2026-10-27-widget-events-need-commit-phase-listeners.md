# Attach verification listeners before a committed widget can emit

Date: 2026-10-27.

## Evidence

Token head `017a509443ead9b58febc940b4b63ed4aab70a97`, CI
[40591509438](https://github.com/GraphDone/GraphDone-Core/actions/runs/40591509438),
failed the web CAPTCHA case: expected the latest verified callback to contain
`issued-proof`, received an empty string. The DOM-presence assertion had passed.
The log does not itself record React phase ordering.

The deterministic regression wraps the actual component in `React.Profiler`.
Its commit callback dispatches one verification event for each newly observed
widget, after child layout effects and before passive effects. Against the old
component, `npm exec --workspace @graphdone/web -- vitest run src/components/AuthCaptcha.test.tsx`
failed the new case while four existing controls passed. Changing only the
listener/reset block to `useLayoutEffect` passed all five. An independent probe
reproduced the same before/after outcome.

A first local unbounded full-suite run also retained an unrelated 5-second
WorkItemDetailsModal timeout and its subsequent save-control failure. With the
same action deadlines and bounded workers (`--maxWorkers=2 --minWorkers=1`),
the complete web suite passed 353/353. This is explicitly different execution
configuration, not a silent retry or proof of that timeout's precise cause.

## Cause and corrective rule

A committed custom element can be visible before a passive effect installs its
event listener. An immediately emitted proof can therefore be lost. Attach and
clean up the verification listener in the layout phase; policy fetching and
focus behavior remain passive. Preserve failure, expiry and replacement resets.
See [React layout effect timing](https://react.dev/reference/react/useLayoutEffect).

Test the early event through actual React commit ordering. Retain controls that
replacement widgets deliver events and removed, prior-action and unmounted
widgets cannot deliver stale proofs. Do not fix this with an added test wait,
retry, or longer timeout. No authentication policy or proof validation changes.

## Limits

The regression proves this lifecycle hazard, not the exact CI scheduling trace.
It does not certify arbitrary custom elements that synchronously emit from a
constructor or connectedCallback before React attaches refs. Installed ALTCHA
initialization yields asynchronously; actual production-mode browser acceptance
and final exact-head CI remain separate gates.

The corrected source passed build, types, lint and 179/179 harness checks.
The rebuilt SPA against its owned production-mode API passed all four
`qc:captcha` browser cases in 17.8 seconds with one worker and zero retries:
real proof/wrong-password/retry at 390px and 1440px, direct forged/absent REST
and GraphQL rejection, and pending/failed/expired submission blocking.
