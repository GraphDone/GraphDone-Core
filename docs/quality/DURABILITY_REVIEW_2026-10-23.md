# Pending saves must survive view navigation, and deletion needs settled connection evidence

On 2026-10-23, independent review of the durability changes reproduced two gaps with the rendered React hooks and the real offline Apollo adapter.

## Evidence

- Before the deletion correction, `npm run test --workspace @graphdone/web -- src/lib/offline/link.test.ts` failed three new scenarios (5 passed): delayed edges, failed edges, and switching graphs while the next graph's edges were pending. With tasks `a`, `b`, `c` and edge `a → b`, the dialog offered all three tasks as unconnected before the edge query completed. The offline adapter then deleted the selected connected tasks too.
- Before the lifetime correction, the hook navigation regression failed with `expected spy to be called 2 times, but got 1 times`: after a failed save, unmounting Graph discarded the pending queue. Keeping the browser tab open did not preserve that component-local state.
- After correction, the focused adapter/modal tests pass (8/8), provider/hook lifecycle tests pass (8/8), and queue/auth-link tests pass (13/13). Commands: `npm run test --workspace @graphdone/web -- src/lib/offline/link.test.ts src/hooks/__tests__/usePositionSaveQueue.test.ts src/lib/__tests__/positionSaveQueue.test.ts src/lib/__tests__/authLink.test.ts`.

## Cause and corrective rule

An empty connection map is not evidence that a task is unconnected. Destructive controls now require successful, settled task and connection results for the current query variables; loading, partial/error, and changed-graph results fail closed. Query results are the source of truth after mutations, and mutation completion awaits their refetch.

An in-memory retry queue must live at least as long as the navigation it promises to survive. A provider above the routed application retains pending layouts by account and graph. Leaving a graph detaches its save callback; reopening that graph as the same authenticated account attaches a fresh callback and retries. Each save checks the current session owner, the mutation includes its graph filter, and the HTTP auth link rechecks the owner before attaching a current token. A failed request for another owner cannot be preserved as the newly signed-in account's draft.

The provider retains at most 16 graph/account scopes and 10,000 distinct pending tasks per scope, counting in-flight work. It reclaims only inactive empty scopes. Capacity errors are explicit and never silently evict pending work. A browser-leave warning remains active while pending work exists, including in List view. Tests cover failure during navigation, newer edits during an older in-flight failure, graph/account isolation, logout during a bounded batch, token refresh, and capacity behavior.

## Limits

Pending layouts are tab-memory state, not a persistent outbox: a forced close, crash, or browser ignoring the unload warning can still lose them. While in List or another route, the queue waits for the original graph to reopen; the user-facing retry message says so. Already-issued requests can complete under their original account, but later requests cannot use a replacement account's credentials. These tests do not establish browser rendering, live-service health, cross-device conflict resolution, or backend atomic deletion protection; those require separate integration/release checks.
