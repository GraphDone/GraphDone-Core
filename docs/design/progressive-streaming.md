# ADAPT-4: Progressive Graph Streaming — Design

> Status: design accepted (2026-06-11). Implementation next.
> Story: ADAPT-4 in [USER_STORIES.md](../USER_STORIES.md). Budget: TTFP < 2s on simulated 3G for a 1k-node graph.

## Problem

The graph view fetches **every** work item and edge in the graph in one query. At 1k+ nodes on a slow link this blows the time-to-first-paint budget, and most of those nodes land outside the initial viewport anyway. Quality tiers already bound how much we *render* (`maxInitialNodes`); nothing bounds what we *fetch*.

## Principle

Stream by **relevance, then proximity**: the user's own active work and the graph's highest-priority items paint first; the periphery arrives in background pages and joins the simulation incrementally (the identity-preserving merge in `graphDataMerge.ts` was built for exactly this — new nodes enter without disturbing the living layout).

## Mechanics

### 1. Ranked initial slice (server does the ordering)

One GraphQL query, bounded by the quality profile:

```graphql
workItems(
  where: { graph: { id: $graphId } }
  options: {
    limit: $maxInitialNodes        # from profileForTier(): 75/150/300/500
    sort: [{ priority: DESC }, { updatedAt: DESC }]
  }
)
```

Plus a parallel "mine first" query (`assignedTo/owner = me, status IN_PROGRESS|BLOCKED`, limit 25) unioned client-side. Both are cheap Neo4j index scans — no new server code for slice one.

### 2. Frontier edges

Fetch edges where **both** endpoints are in the loaded set (`source.id IN $ids AND target.id IN $ids`). Edges with one loaded endpoint define the **frontier**: render a small badge on the loaded endpoint ("+3") so the user sees there's more world out there.

### 3. Background fill

After first paint settles (simulation alpha < 0.1), page the remainder (`offset` pagination, same sort, pages of 100, one in flight at a time, idle-callback scheduled). Each page flows through `mergeSimulationNodes/Edges` — entering nodes spawn near their first loaded neighbor (not at origin) and fade in at LIVE-8 cost rules. LOW tier + Save-Data stop background fill entirely until the user pans toward a frontier badge (tap-to-expand).

### 4. Viewport-directed priority

When the user pans/zooms near a frontier badge, that badge's neighborhood jumps the queue (one query: 1-hop of that node, limit 50). This is the only interaction-driven fetch; everything else is automatic.

## What changes where

| Layer | Change |
|-------|--------|
| `useAdaptiveQuality` | already provides `maxInitialNodes` — no change |
| `InteractiveGraphVisualization` | initial query gains `options.limit + sort`; new `useProgressiveFill` hook owns paging state |
| `graphDataMerge` | no change (designed for this) |
| server | none for v1; v2 adds a `graphSlice` query with server-side union (mine + top-priority) if two queries prove chatty |
| MCP | `get_graph_context` already gives agents the bounded view; `browse_graph` already paginates |

## Test plan (write first)

- unit: `useProgressiveFill` paging state machine (pages, in-flight cap, LOW-tier gating)
- e2e: 1k-node seeded graph fixture (perf harness reference graph), Playwright `slow-3g` emulation: first paint < 2s, frontier badges visible, background fill completes, no layout explosion (max node displacement during fill < 100px)
- perf: dropped-frame budget unchanged during fill (PerfMeter assertion in the bench)

## Failure modes considered

- **Page drift** (items created/deleted between pages): offset pagination can skip/dup; dedup is free (merge is id-keyed) and a final reconciliation query (ids-only, compare counts) closes gaps.
- **Sort stability**: `priority DESC, updatedAt DESC, id ASC` tiebreaker.
- **Frontier badge stale counts**: recomputed per merge; badges are hints, not contracts.
