# A persisted layout receipt does not by itself authorize replay

Date: 2026-10-28 UTC. Issue #181. Existing guidance distinguishes the old in-tab
queue from crash recovery; the first persistence prototype exposed additional
ordering boundaries during independent review. The corrections and regression controls now accompany this lesson. Final
exact-head review and CI remain the integration gate; preparatory local results
are not a release or hosted acceptance record.

## Evidence

The prototype is based on `525ca4e`, with its tracked patch and relevant source
hashes retained as `layout-reviewed-prototype.patch` and
`layout-reviewed-prototype-sha256.txt` in the owned dated evidence directory.
Twenty-three focused tests passed, but they did not cover the following cases.

On 2026-10-28, Node 22.18 ran the retained owned probes:

```sh
node /tmp/graphdone-resolution-20261027/layout-review-probes/probe.mjs
node /tmp/graphdone-resolution-20261027/layout-review-probes/discard-race.mjs
```

Sanitized output in `layout-review-negative.log`:

- Another tab saved `x=20` and cleared its receipt; the old tab then replayed
  `x=10` and reported no pending work.
- A server accepted `x=30`, but local receipt cleanup failed. The prototype
  reported `acknowledged=false`; retry sent the position again, replacing a
  newer server value of `99` in the probe.
- A quota failure left one memory-only position. Discard tried to persist that
  unwanted position first and failed, leaving it pending.
- Holding discard's commit and calling flush sent the position being discarded.

Source review also found that asynchronous recovery could arrive after D3
initialization without changing live coordinates, and that mapping pending
positions into a fresh work-item array on every camera render invalidated LOD
projection/label memoization. Both require actual browser regressions.

A second review reproduced a subtler variant after the first seven ordering
regressions passed. A quota-failed, memory-only edit could persist itself on
reconnect after another tab had already saved and cleared a newer receipt:

```text
oldAfterQuota {"pending":1,"local":0}
beforeOldReconnect {"server":20,"receipts":[]}
afterOldReconnect {"server":10,"sent":[["new",20],["old",10]],"pending":0}
```

The matching bundled probe is retained at
`layout-review-probes/corrected-prototype/volatile-stale.mjs`; the new failing
unit assertion is retained in `layout-volatile-negative-unit.log`. A real
IndexedDB/two-tab browser regression now covers the same ordering boundary.

The held-IndexedDB graph-switch regression also failed before the simulation
scope correction: after A→B, a synthetic pagehide raised **Layout needs
attention** because A's still-live simulation tried to queue through B. Graph
filters prevented a cross-graph server write, but did not establish correct
renderer ownership. `layout-switch-negative.log` retains that failed run.

The pending-layout LOD browser regression passed with stable memo inputs.
Deliberately recreating the source array during every camera render made it
fail after pan: labels moved between slots, including a 96px row change. The
corrected renderer was then restored byte-for-byte; the negative control remains
in `layout-lod-identity-negative.log`.

## Cause and corrective rule

Revision comparison during deletion protects newer receipts from old cleanup;
it does not establish eligibility to send an old receipt. Coordinate current
receipt eligibility, sending and acknowledgement across tabs. Preserve known
server acceptance separately from local cleanup, so cleanup retry cannot
silently become another network write. Serialize discard and flush, and do not
require a failed write to succeed before abandoning memory-only changes.

Persistence must also preserve eligibility. Compare the staged batch's original
observed graph generation inside the same account transaction that persists it.
Do not silently rebase a failed staged edit after reading a newer generation.
Retain generation fences after ACK/discard; a bounded graph-fence map falls back
to an eviction watermark advanced to the account counter only when an old entry
is evicted. Ordinary unrelated graph saves must not advance that fallback. Validate
safe integers and fail at corruption/overflow. The first fallback used the
current counter and unnecessarily rejected an unrelated graph’s first save;
`layout-fence-unrelated-negative.log` retains that failure. This deliberately rejects some
concurrent independent edits rather than guessing how to merge coordinates.

Hydrate layout recovery before initializing the graph, or explicitly apply an
eligible recovered revision to the live renderer. Keep semantic source identity
stable during camera changes. Durability status must reflect the actual boundary
completed, including the absence of a successful initial storage read. Stop the
previous owner/graph simulation during layout cleanup and validate its scope at
each persistence boundary; hiding its SVG does not stop its callbacks.

## Limits and remaining work

The probes use an owned account-store double; they are evidence of the ordering
failures. The subsequent strict browser run passes eight cases against the owned
API/Neo4j stack, with real IndexedDB and an isolated browser process group killed
by SIGKILL. It includes delayed hydration, reload before ACK, restart, quota and
two-tab ordering, account isolation, deleted/revoked access and Settings discard,
accepted-save cleanup, and unsupported capabilities. See the
[layout recovery record](../../docs/quality/LAYOUT_RECOVERY_2026-10-28.md) for
commands, the pending-layout LOD gate, retained fixture failures and limitations.

The first process-loss run failed strict profile removal with ENOTEMPTY. Killing
only the browser parent did not bound all profile writers. The fixture now owns
an isolated process group, kills that exact group and awaits the child exit
before reopening/removing its profile. No broad process matching or removal
retry was substituted for ownership. The next run caught a fixture viewport
mistake: the restarted browser used its default width and the desktop selector
was correctly hidden. The fixture now explicitly restores its intended viewport.
Both failures remain retained; neither was an application durability pass.

Issue #181 excludes server-side multi-actor conflict resolution. A crash after
server acceptance but before durable receipt deletion leaves an ambiguous
at-least-once boundary without a server idempotency/revision contract. Do not
claim exactly-once replay or protection from later writes on another device.
Known acceptance in the live process still requires truthful cleanup-only retry.
