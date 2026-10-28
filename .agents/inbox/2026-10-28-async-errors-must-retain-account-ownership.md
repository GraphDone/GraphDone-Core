# Async errors must retain account ownership instead of relabeling newer state

Date: 2026-10-28 UTC. Independent review of layout candidate
`c4df01e1567af10b6c4b0dc9d666ad946c1e0b75` found a Settings disclosure race.
The existing receipt-ordering lesson covered database writes; this incident
concerns the owner of already loaded UI state on an asynchronous error path.

## Evidence

The retained owned probe and unit regression ran with Node 22.18.0:

```sh
node /tmp/graphdone-resolution-20261027/layout-settings-review-negative/probe.cjs
npx vitest run src/hooks/__tests__/useLayoutRecovery.test.ts --root packages/web
```

A starts a discard while its account read is held. B signs in and B's pending
graph list loads. A's discard rejects after the held read returns. The old catch
spreads the newest state, including B's scopes, and overwrites its owner with A.
Returning to A before its next read resolves printed:

```text
visibleToA [{"graphId":"b-private-graph","count":1}]
error The signed-in account changed. No further layout changes were discarded.
```

`layout-settings-negative-unit.log` retains the failing hook test. After the
correction, `layout-settings-corrected-unit.log` reports 43 passed across seven
focused suites, including the new delayed account-switch regression.

## Cause and corrective rule

An owner label is provenance, not a presentation field to replace on failure.
Associate operations with the current owner scope identity, ignore stale
completion/error paths, and retain prior scopes only if their recorded owner
matches. Scope busy state too, so a previous owner's completion cannot clear a
new owner's pending operation. Number refresh requests to ignore older reads.
Test errors after a replacement account's data has loaded, and inspect the
first render after returning before the fresh read completes.

## Limits

The probe and unit test use a controlled account store. They prove the UI
interleaving, not hosted authorization or backend isolation. Existing real
browser account-switch and deleted-graph regressions remain required, as do
renewed exact-head review and strict CI before integration.
