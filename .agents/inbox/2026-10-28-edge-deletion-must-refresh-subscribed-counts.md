# Refresh every subscribed edge query after deleting a relationship

On 2026-10-28, inspecting the actual `priority-typography10` desktop/phone
JSON exposed a count mismatch after the intentional BLOCKS deletion: canonical
API data and the graph dock had four relationships, while the graph-selector
header still read `4 nodes, 5 connections`. Existing cache/count lessons did
not cover this query-variable mismatch.

The stronger desktop assertion failed before the fix:

```text
priority-count11: 0 passed, 1 failed, 20.15 seconds, zero retries
Expected: 4 nodes, 4 connections
Received: 4 nodes, 5 connections
Timeout: 5000ms (14 reads of the unchanged header)
```

The failed report, screenshot and trace remain in the owned evidence directory.
The exercised command was the existing `relationship-priority.spec.ts` with
`--grep 1440 --headed --workers=1 --retries=0`, using only owned graph fixtures.

Cause: the selector observes `GET_EDGES` with a source-graph filter; the graph
observes the same document with source-or-target filtering. The relationship editor had no mutation refetch configuration and its parent
callback refreshed only the renderer’s variables. Apollo stores those root lists
separately, so normalized entity updates alone did not remove the stale ID from
the selector's list. The selector does not poll.

The correction supplies `GET_EDGES` itself to the mutation's `refetchQueries`,
on the editor’s explicit Delete action, so Apollo refreshes matching observed
queries using their own variables. The
installed `QueryManager.getObservableQueries` implementation was inspected to
verify document matching. The editor awaits those refetches before reporting completion. Its separate
flip workflow is unchanged; no graph membership, priority policy or persisted
position changes.

Corrective rule: when deleting records represented by independently filtered
query lists, refresh the subscribed lists or explicitly update each affected
cache field. Test the user-facing count as well as the canvas and server state.
Do not add polling merely to hide a mutation invalidation gap.

The desktop/phone priority journey now requires the header to change from five
to four connections after the one authorized deletion, alongside original-ID
fallback, rendered text/wire geometry, no extra mutations and unchanged nodes.
Final committed-source CI and independent review remain required. This is a
deletion-path correction, not proof of every other mutation or cross-client
refresh path.

An initial local attempt changed the graph canvas mutation instead of the
editor’s actual Delete action. `priority-count12` still failed the desktop header
assertion; that attempted source change was reverted. Its phone case separately
failed an earlier keyboard-return assertion before deletion; that report and
trace are retained for independent review. A passing subsequent count test alone
does not explain or erase that separate failure.

With the correction on the actual editor action, `priority-count13` passed both
complete desktop/phone journeys in 25.22 seconds, zero retries. The retained
final typography samples now show `4 nodes, 4 connections`; all original API,
priority, focus and geometry assertions also passed.

Independent review traced the separate count12 focus failure to stale label
clearance after the relationship panel closes. Its deterministic failing-before
regression and correction are in [the priority context lesson](2026-10-28-priority-controls-must-preserve-context.md).
