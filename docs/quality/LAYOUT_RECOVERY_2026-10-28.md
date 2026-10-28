# Pending layout recovery across reload and browser process loss

Issue #181 extends the existing navigation-safe position queue. The underlying
Core source starts at reviewed `525ca4e`; integrated dev `780a759` has the same
complete tree. Local preparatory results below used the isolated working tree,
not unchanged `525ca4e`. The containing PR's exact head, independent review and
final CI determine integration eligibility.

## Supported behavior

In network-backed mode, dragging queues the newest coordinates per owner,
graph and node. The existing `graphdone-offline` account store commits the
receipt in a strict IndexedDB transaction before the queue sends it. The UI
separately reports positions retained only in this tab, positions committed on
this device, pending sends, and server acceptance. A known server acceptance
followed by failed receipt cleanup remains accepted; retry performs cleanup
without sending the coordinates again.

The queue hydrates before graph initialization. A delayed or failed initial
storage read cannot render an older server layout and silently ignore recovered
coordinates. Switching owner/graph stops the previous simulation and checks its
scope at save callbacks. Pending position snapshots and their work-item overlay
retain identity across camera renders, preserving LOD projection and label
placement memoization.

Leaving Graph for Work list detaches the callback but retains the queue. Reload
or browser restart recovers committed receipts when the same account and graph
return. Each actual mutation still checks the current owner, exact bearer
snapshot and graph filter. A rejected or empty mutation result retains work.
Logout and another account cannot replay the original account's positions.

Settings → Pending layouts lists this account's pending graph scopes, including
graphs that are no longer accessible or have been deleted. Discard requires an
explicit confirmation there. In the active graph, Retry and Discard unsent
layout operate on its scoped queue. Discard never needs to persist a memory-only
edit first, and reconnect cannot send while its discard is in progress.
Already-issued server requests cannot be recalled by discarding local work.

In `VITE_OFFLINE_SYNC=true` mode, the existing local project mutation and sync
engine remain the authority. Successful local mutation means saved on this
device, while upload/conflict status remains in the existing sync UI. This
change adds no second layout outbox in that mode. Network receipts and their
generation fences are excluded from portable offline backups.

## Ordering, retention and limits

- A fresh receipt check, send and cleanup run under a Web Lock keyed by owner,
  graph and node. Missing Web Locks are explicit and prevent uncoordinated
  network replay. Missing/unusable IndexedDB or quota failures also remain
  explicit; no durable or server-saved status is invented.
- Persistence compares the batch's original observed graph generation inside
  its account transaction. A stale volatile edit cannot write itself back after
  another tab saves. Conflicting edits remain in the tab with a visible message;
  discard and reload to adopt the newer layout. Reads never silently rebase an
  already-staged edit. This conservatively rejects simultaneous edits on
  different nodes in the same graph too.
- ACK removes only the matching receipt revision. Explicit durable discard also
  advances its graph fence. Account counters and at most 16 recent graph fences
  survive the last receipt's removal. An eviction advances a retained watermark to the new account counter;
  absent graphs fall back to that watermark, preventing reuse of an older
  generation. Unrelated graph saves without eviction leave that fallback stable. Eviction can cause
  a conservative conflict after unrelated graph activity. Invalid or exhausted
  safe-integer counters fail explicitly.
- Persistent pending work is bounded to 16 graphs and 10,000 positions per
  account. The provider retains at most 16 account/graph scopes and the existing
  per-scope queue bound. Capacity rejection preserves earlier work. There is no
  automatic receipt expiry; ACK or explicit discard removes it.
- Only IDs, finite bounded coordinates, timestamps and revision metadata are
  stored by this feature. It stores no bearer/session credentials. It does not
  encrypt browser data or survive clearing/eviction of the browser's storage.
- SIGKILL acceptance proves recovery after this owned browser process group
  terminates, following a completed IndexedDB transaction. It does not prove
  recovery after power loss, hardware failure or an operating-system storage
  failure. Edits still labelled only-in-tab can be lost on termination.
- A crash or lost response after the server has applied a write but before its
  receipt is removed is an ambiguous at-least-once boundary. In-flight requests
  may also finish after a browser dies. Server idempotency/revision ordering and
  multi-device conflict resolution are outside #181; this is not exactly-once
  replay or a guarantee against later writes by another actor.

## Regression evidence

The dated, owned local evidence directory is
`/tmp/graphdone-resolution-20261027`. It is not a published artifact or a
substitute for the repository regressions and PR checks.

| Boundary | Retained negative/control and corrective evidence |
| --- | --- |
| Provider loss | Original provider-replacement test failed with zero recovered sends; corrected provider recovers the newest coordinates. |
| Receipt and discard ordering | Seven ordering cases failed before correction. Tests cover stale durable replay, accepted-save cleanup, quota-only discard, pending discard versus flush, same-item serialization, unsupported locks and stable snapshot identity. |
| Volatile stale replay | Matching bundled probe changed server `20 → 10`; the added regression failed before generation CAS. The actual two-tab/quota browser test now preserves the newer real server save. |
| Renderer scope | Held-IDB A→B switch plus pagehide raised erroneous layout attention before simulation ownership cleanup. The corrected browser test passes with no wrong-scope receipt. |
| Process ownership | First process-loss run failed profile cleanup; owned process-group termination fixes the writer lifetime. A second failed fixture assertion exposed the missing restart viewport, then explicit viewport restoration fixed it. |
| Fence isolation | A fresh graph incorrectly conflicted after an unrelated graph saved. `layout-fence-unrelated-negative.log` retains the failure. Advancing the fallback only on actual eviction preserves independent graph edits while retaining stale/evicted fence rejection. |
| Pending-layout LOD | Reintroducing a fresh item-array identity moves overview labels between slots during a real pan (including a 96px row change). `layout-lod-identity-negative.log` retains the expected failure. The corrected memoized source passes the same camera/label/zero-write assertions. |
| LOD fixture setup | First pending-layout probe passed camera translation instead of graph coordinates to the minimap hook. The corrected probe then wheeled over the minimap after panning. Both failures are retained; the final fixture targets an overview card explicitly. |

The strict eight-case browser run in `layout-recovery-strict-first/report.json`
passed 8, failed 0, warned 0 and skipped 0, with exit 0, no timeout or evidence
errors. It uses real owned API/Neo4j data and IndexedDB: two real drags/reload
before ACK, delayed hydration, owned process restart, graph switching, actual
two-tab quota ordering, account isolation, revoked writes and deleted nodes/
graphs, Settings discard, accepted-response cleanup, and unavailable storage/
coordination. The pending-layout LOD case passes separately, and its deliberate identity-regression negative fails on changed label slots. All nine cases subsequently passed, but that run was rejected by the source-integrity gate because staging changed the repository fingerprint during execution. It is retained as failed evidence, not final acceptance; a committed, frozen-tree run is required.

The local full coverage invocation passed 739 tests; 26 existing database
integration cases remain explicitly separate, not counted as passes. All 193
harness tests passed. Build, types and lint passed; lint retains the existing
warning inventory and build retains its chunk-size warning. These numbers do
not establish comprehensive statement/branch coverage, hosted D1 parity or
release readiness.

Run the browser gate against an owned Core stack, with explicit Neo4j fixture
credentials (the access-revocation test changes only its newly created graph):

```sh
TEST_URL=http://localhost:3127 xvfb-run --auto-servernum \
  node tests/run-unified.mjs --sequence layout-recovery --out test-artifacts/layout-recovery
```

The sequence enforces one worker, zero retries and failure-only trace retention;
CI runs it in the existing Smoke Gate. Its fixture registers graph IDs at
creation, restores any temporary ownership change, deletes edges before nodes,
and verifies graph removal. The process-loss case owns and removes only its
temporary browser profile. Local Chrome and CI Chromium are separate browser
builds; neither is evidence for all engines, real phones or hosted D1.

The existing smoke Graph→List→Graph/ACK/reload case, auth-link token checks,
offline project transfer, semantic LOD and motion gates remain required.
