# Pending saves must survive view navigation, and deletion needs settled connection evidence

On 2026-10-23, independent review of the durability changes reproduced two gaps with the rendered React hooks and the real offline Apollo adapter.

## Evidence

- Before the deletion correction, `npm run test --workspace @graphdone/web -- src/lib/offline/link.test.ts` failed three new scenarios (5 passed): delayed edges, failed edges, and switching graphs while the next graph's edges were pending. With tasks `a`, `b`, `c` and edge `a → b`, the dialog offered all three tasks as unconnected before the edge query completed. The offline adapter then deleted the selected connected tasks too.
- Before the lifetime correction, the hook navigation regression failed with `expected spy to be called 2 times, but got 1 times`: after a failed save, unmounting Graph discarded the pending queue. Keeping the browser tab open did not preserve that component-local state.
- After correction, the focused adapter/modal tests pass (8/8), provider/hook lifecycle tests pass (8/8), and queue/auth-link tests pass (15/15), and stale-response ownership tests pass (3/3). Commands: `npm run test --workspace @graphdone/web -- src/lib/offline/link.test.ts src/hooks/__tests__/usePositionSaveQueue.test.ts src/lib/__tests__/positionSaveQueue.test.ts src/lib/__tests__/authLink.test.ts src/lib/__tests__/apolloErrors.test.ts src/lib/__tests__/authStorage.test.ts`.

## Cause and corrective rule

An empty connection map is not evidence that a task is unconnected. Destructive controls now require successful, settled task and connection results for the current query variables; loading, partial/error, and changed-graph results fail closed. Query results are the source of truth after mutations, and mutation completion awaits their refetch.

An in-memory retry queue must live at least as long as the navigation it promises to survive. A provider above the routed application retains pending layouts by account and graph. Leaving a graph detaches its save callback; reopening that graph as the same authenticated account attaches a fresh callback and retries. Each save checks that the cached user matches the current token identity (Core `userId`/`id`, hosted `uid`, or a local guest), the mutation includes its graph filter, and the HTTP auth link rechecks the owner of the exact bearer snapshot before attaching it. A cross-tab storage-change regression failed before the single-snapshot check and passes afterward. A failed request for another owner cannot be preserved as the newly signed-in account's draft or clear that replacement session. Independent review reproduced the token transition before this guard: starting an owner-A mutation then calling `setToken` with owner B before the auth-context microtask resolved sent B's bearer while the cached user still identified A; the corrected regression rejects before transport.

The provider retains at most 16 graph/account scopes and 10,000 distinct pending tasks per scope, counting in-flight work. It reclaims only inactive empty scopes. Capacity errors are explicit and never silently evict pending work. A browser-leave warning remains active while pending work exists, including in List view. Tests cover failure during navigation, newer edits during an older in-flight failure, graph/account isolation, logout during a bounded batch, token refresh, and capacity behavior.

## Limits

Pending layouts are tab-memory state, not a persistent outbox: a forced close, crash, or browser ignoring the unload warning can still lose them. While in List or another route, the queue waits for the original graph to reopen; the user-facing retry message says so. Already-issued requests can complete under their original account, but later requests cannot use a replacement account's credentials. These tests do not establish browser rendering, live-service health, cross-device conflict resolution, or backend atomic deletion protection; those require separate integration/release checks.


## 2026-10-28 follow-up

The historical memory-only limit above is addressed by issue #181's
[network-backed layout recovery implementation and evidence](LAYOUT_RECOVERY_2026-10-28.md).
It reuses the existing account IndexedDB store, adds account/graph/node receipts
and bounded local generation fences, and keeps offline-sync durability separate.
The original navigation, owner/token and deletion regressions remain required.
