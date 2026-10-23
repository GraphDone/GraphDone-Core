# A save acknowledgement must preserve edits made after submission

Date: 2026-10-23. Reproduction baseline: combined revision `aece679`.

## Symptom and cause

The strict new-user browser gate's 390px graph-details case saved a due date,
observed it in Core API readback, then cleared the date while the first save was
still awaiting query refetches. The first save's completion restored the date
and disabled Save. The failure screenshot is retained in the audit artifacts at
`strict-new-user/assets/new-user/1.png`. An isolated rerun of the unchanged 390px
case passed in 36.7 seconds; that does not negate the intermittent failure.

`WorkItemDetailsModal` used one mutation-level `onCompleted` callback for both
save and undo. After `awaitRefetchQueries`, it replaced both `editedNode` and
`savedNode` with the earlier response. A guard on background `node` prop refresh
could not protect against that callback. Returning a draft to its original
saved value while a write was pending also made the draft appear clean, letting
the optimistic/cache refresh overwrite that deliberate edit.

Independent review found a related history race: Workspace clears one reused
UndoStack when switching graphs. A pending save could complete afterward and
push the old graph's inverse into the new graph's cleared history.

## Corrective rule

Each write captures its submitted snapshot and editor session (owner, graph,
item, and opening). Its acknowledgement advances the saved baseline, then
merges only fields that have not changed since submission. Pending writes block
background replacement even when the current draft matches the older saved
baseline. A completion or failure from an earlier editor session cannot replace
the current form or show a stale notification.

Undo keeps the confirmed save's previous snapshot and preserves fields edited
before or during the inverse request. UndoStack exposes a clear generation;
completion may register an inverse only if that generation still matches.
Workspace also clears history when the owner changes. Closing a modal without
clearing history still lets the successful in-flight save register its inverse.

A completion must also confirm exactly the requested item before updating the
saved baseline, reporting success, or registering undo. Empty and wrong-item
results are rejected for save and undo. GraphQL response errors preserve the
newer draft and allow retry; undo rejection reaches its caller. The existing
UndoStack policy of removing a failed inverse is unchanged. The current Apollo
defaults use `errorPolicy: 'all'` for reads only; these tests retain the actual
default rejection policy for mutations.

## Dated deterministic evidence

On 2026-10-23 with Node 22.23.4 and a clean pinned `npm ci`:

```text
npm test --workspace=@graphdone/web -- src/components/WorkItemDetailsModal.test.tsx

Initial 11 completion/history tests with original aece679 modal and UndoStack:
9 failed, 2 passed

Final tests with the fix:
18 passed

npm test --workspace=@graphdone/web -- src/components/WorkItemDetailsModal.test.tsx src/lib/__tests__/undoStack.test.ts
25 passed

npm test --workspace=@graphdone/web
326 passed across 40 files

npm run build --workspace=@graphdone/core
npm run typecheck --workspace=@graphdone/web
npm run build --workspace=@graphdone/web
exit 0 (web build retains existing large-chunk warnings)
```

The tests render the real modal in React StrictMode with a real Apollo client,
cache, mutation hook, optimistic response and `awaitRefetchQueries`. An in-memory
link acknowledges the mutation and holds the edge refetch so a user can make a
newer edit in a deterministic completion window. It also tests reverting a
field before mutation acknowledgement, navigation to a different item, reopening
the same item, owner/graph changes, failure/retry, stale failure notifications,
two consecutive saves and inverse snapshots, editing during undo, cleared
history, and normal modal unmount followed by undo.

The final suite also rejects GraphQL response errors, empty acknowledgements and
wrong-item acknowledgements for both save and undo. Before the acknowledgement
guard, those six cases produced four failures and two passes (GraphQL errors
already rejected correctly). Removing only the generation check makes the
unmounted/cleared-history regression fail with two history entries instead of
one, while the mounted context-switch case still passes. This negative control
proves the generation check independently of the graph/owner guard.

The browser test's existing 16-second draft pause is not proof of a full polling
cycle: `GraphVisualization` polls at 60 seconds. Its misleading comment is
corrected; the controlled Apollo refetch regression establishes this specific
retention property without relying on elapsed time.

## Limits

This is a local draft/completion and undo-history fix. It does not add autosave,
durable drafts across page closure, or server-side conflict resolution between
different actors. The component fixture uses an in-memory link and mocked
account/graph/notification contexts; it is not a real API/browser test. The
parent's final combined headed gate must validate the fixed application; the
unchanged baseline's passing isolated rerun is recorded only as diagnostic
evidence. Apollo's existing `canonizeResults` development warnings remain visible
in the component-test output.
