# Snapshot replacement helpers must not consume individual graph pages

Date: 2026-10-27 UTC. Searched the current symptom/performance indices,
`docs/design/progressive-streaming.md`, and the October semantic-LOD proposal.

## Evidence

At current Core dev `ef495eff15ed7aac51e72dc7a1db1bb96d2b3695`:

```text
packages/web/src/lib/graphDataMerge.ts
mergeSimulationNodes:
  incomingIds = new Set(incoming.map(n => n.id))
  removedIds = simNodes.filter(n => !incomingIds.has(n.id)).map(n => n.id)
  returned nodes are populated only from incoming
mergeSimulationEdges:
  if (!sourceNode || !targetNode) { droppedIds.push(fresh.id); continue; }
```

The older streaming design says background pages can flow directly through these
identity-preserving helpers with no change. Source contradicts that assumption:
identity preservation for retained objects is not append semantics.

The existing focused suites were also run in the prior semantic-review worktree
(`01f0c4d`) on 2026-10-27:

```text
npm run test -w @graphdone/web -- \
  src/lib/__tests__/edgeLOD.test.ts \
  src/lib/__tests__/parallelEdges.test.ts \
  src/lib/__tests__/graphDataMerge.test.ts \
  src/lib/__tests__/adaptiveQuality.test.ts
4 files passed; 60 tests passed
```

The merge suite explicitly tests removed IDs and dropped missing-endpoint edges.
These tests verify the existing full-snapshot contract, not a streaming fix.

## Cause and corrective rule

The design conflated preservation of object identity with accumulation of partial
data. Introduce a canonical loaded-data registry with distinct snapshot/page/
update/tombstone operations. Reconcile a page into that registry first. Pass the
reconciled loaded set to the D3 identity merge. Keep unresolved endpoints in a
pending-edge registry until loaded or explicitly deleted; do not equate unloaded,
filtered and deleted states. Bind pages to graph/access scope and revision.

## Limits and regression path

This is a source-level design incompatibility, not a reproduced production
streaming outage: streaming is not implemented. Preserve existing complete-
snapshot deletion semantics. LOD-1/LOD-7 in the
[continuation](../../docs/architecture/dynamic-graph-lod.md) require two-page
accumulation, delayed endpoint, explicit deletion, stale revision and graph/account
switch tests. No new runtime test is needed to claim this plan-only correction;
passing future streaming tests remains an implementation requirement.
