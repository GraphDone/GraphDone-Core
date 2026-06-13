# GraphDone Systems Reference

> The map of what's actually shipped and where it lives. Every entry points at
> its source, its tests, and the user story it satisfies. If you're a new
> developer or an AI agent trying to find or extend a subsystem, start here.
>
> Status legend: ✅ shipped · 🧪 shipped, hardening · 🔨 in progress · 💤 designed

## Quality gates (run these before claiming anything works)

| Gate | Command | What it proves |
|------|---------|----------------|
| **THE GATE** ✅ | `TEST_URL=http://localhost:3127 npm run test:smoke` | The app works from a user's view: login → nodes **and** edges render → no GraphQL errors reach the client → no uncaught JS → grow + undo work → no orphan edges in the DB. See `tests/e2e/user-smoke.spec.ts`. |
| Unit suites | `npm run test` (turbo) or `npm run test --workspace=@graphdone/<pkg>` | core 41 · web 103 · server 23 · mcp-server ~4740 |
| Living-graph effects | `TEST_URL=http://localhost:3127 npx playwright test tests/e2e/living-graph.spec.ts` | The differentiator actually renders: breathing, glow, energy-flow, blocked-ache, hover-illumination, reduced-motion suppression. Self-seeds a fixture; gated in the smoke job. |
| Performance budgets (ADAPT-8) | `npm run perf:bundle` + `TEST_URL=… npm run test:perf` | Bundle gzip ≤ 450kB; graph settles to rest, avg tick ≤ 8ms, layout drift ≤ 25px, query p95 ≤ 800ms. Gated in CI. |
| MCP real-Neo4j contract | `RUN_DB_CONTRACT=1 NEO4J_URI=… npx vitest --run tests/neo4j-contract.test.ts` (in packages/mcp-server) | MCP Cypher (node/edge lifecycle, browse) against a LIVE Neo4j — catches DB drift the mock hides. Gated in CI. |
| Types | `npm run typecheck` | All packages compile |
| Lint | `npm run lint` | 0 errors (warnings allowed) |
| Build | `npm run build` | Production build succeeds |
| Showcase report | `TEST_URL=http://localhost:3127 npm run report:showcase` | Records .webm video + screenshots of every mode at all 5 resolutions → `test-artifacts/showcase/index.html` (also an every-PR CI artifact). |

**Why THE GATE exists:** a real incident — orphaned `Edge` records made the
edges query 500 and the UI showed "Error" with zero edges, while every unit
test stayed green. Green units ≠ working app. CI now boots the full Docker
stack and runs this gate on every push/PR (`.github/workflows/ci.yml`).
**When using the GraphQL API directly, delete a WorkItem's edges before the
item** — orphan edges break the entire edges query.

## The living graph (Epic 1)

| System | Source | Tests | Story |
|--------|--------|-------|-------|
| Node life-states (breathing / blocked-ache / settled), priority glow, edge energy-flow | `packages/web/src/lib/nodeAnimations.ts` + CSS in `src/index.css` | `lib/__tests__/nodeAnimations.test.ts` | LIVE-1/2/4/5 ✅ |
| Completion celebration bursts (ring ripple + particles, ≤1.2s, 1/node, reduced-motion safe) | `packages/web/src/lib/celebration.ts` | `lib/__tests__/celebration.test.ts` | LIVE-3 ✅ |
| Wake-up entrance (recency-staggered fade-in) | in `InteractiveGraphVisualization.tsx` | — | LIVE-8 ✅ |
| Hover neighborhood illumination (1-hop lit, rest dimmed) | `packages/web/src/lib/graphAdjacency.ts` + CSS `.dim-for-hover` | `lib/__tests__/graphAdjacency.test.ts` | LIVE-7 ✅ |
| Physics that rests (alphaTarget→0; drags/changes reheat) | `InteractiveGraphVisualization.tsx` simulation config | — | LIVE-6 🧪 |

All living-graph motion is gated by the quality tier (`[data-quality]` CSS
selectors) and `prefers-reduced-motion` — accessibility always wins.

## Adaptive performance (Epic 2)

| System | Source | Tests | Story |
|--------|--------|-------|-------|
| Quality engine: LOW→ULTRA tiers from device (cores/memory) + network (effectiveType/saveData/cellular); FPS governor with hysteresis; manual override | `packages/web/src/lib/adaptiveQuality.ts` | `lib/__tests__/adaptiveQuality.test.ts` (30) | ADAPT-1/2/3/5/6/9 ✅ |
| React wiring: live FPS sampling, `connection.change` re-detection, persisted override; sets `data-quality` | `packages/web/src/hooks/useAdaptiveQuality.ts` | — | ADAPT-* ✅ |
| Settings → Visual Quality control (Auto/Low/Med/High/Ultra) | `packages/web/src/pages/Settings.tsx` | — | ADAPT-6 ✅ |
| Perf meter feeding the debug console (fps, tick avg/p95, dropped frames) → `window.__graphPerf` | `packages/web/src/lib/perfMeter.ts` | `lib/__tests__/perfMeter.test.ts` | LIVE perf ✅ |
| Progressive graph streaming (relevance-ranked initial slice, frontier badges, background fill) | design only | — | ADAPT-4 💤 — see [design/progressive-streaming.md](./design/progressive-streaming.md) |

## Friction-free interaction (Epic 5 + the interaction model)

The UX contract — modes, exits, click budgets — is
[design/interaction-model.md](./design/interaction-model.md).

| System | Source | Tests | Story |
|--------|--------|-------|-------|
| Grow mode: `+` on a node → ghost preview → click empty space makes a connected, named child (2 clicks); click a node connects; Esc / right-click / source cancels | `InteractiveGraphVisualization.tsx` (grow handlers, `createInlineNode`) | grow flow in `user-smoke.spec.ts` | FLOW-1/W3 ✅ |
| Inline rename: double-click a node, Enter/Esc, optimistic + undoable | `InteractiveGraphVisualization.tsx` (`inlineEdit`) | smoke | W2 🧪 |
| Undo stack: 36-step LIFO of inverse ops (create/connect/rename/delete); Ctrl/Cmd+Z + context-menu "Undo" for touch | `packages/web/src/lib/undoStack.ts` | `lib/__tests__/undoStack.test.ts` (7) + smoke | FLOW-3 ✅ |
| Dialog manager: one exclusive overlay at a time, global Esc closes top-most, click-outside closes | `packages/web/src/hooks/useDialogManager.ts` | `hooks/__tests__/dialogManager.test.ts` (7) | W1 ✅ |
| Edge editor: opens beside (never over) its edge; edge glows while edited; flip/type/delete live | `RelationshipEditorWindow.tsx` + `InteractiveGraphVisualization.tsx` | — | W24 ✅ |
| Edge label layout: clear-segment placement off node cards, obstacle-aware, user-slidable | `packages/web/src/lib/edgeLabelLayout.ts` | `lib/__tests__/edgeLabelLayout.test.ts` (12) | LIVE labels ✅ |
| Identity-preserving data merge (edges never detach from nodes across polls) | `packages/web/src/lib/graphDataMerge.ts` | `lib/__tests__/graphDataMerge.test.ts` (8) | dynamics ✅ |
| Minimap: type-colored dots, viewport rect, click-to-navigate | `packages/web/src/components/MiniMap.tsx` | — | ✅ |
| Create-graph wizard (2 steps, Enter-to-create, auto-select) | `packages/web/src/components/CreateGraphModal.tsx` | — | ✅ |

## AI-native surface (Epic 4 + Epic 8)

Quickstart: [api/AI_AGENTS.md](./api/AI_AGENTS.md). The MCP server gives agents
the same powers as the UI — *human observable, human optional*.

| System | Source | Notes |
|--------|--------|-------|
| MCP server (browse/create/update nodes & edges, graph CRUD, bulk ops, priority/collab insights) | `packages/mcp-server/src/index.ts`, `src/services/graph-service.ts` | talks to the same Neo4j over Bolt |
| `get_graph_context` — <2kB one-call orientation (counts, blockers, recent activity) | `graph-service.ts` `getGraphContext` | `mcp-server/tests/graph-context.test.ts` · AI-6 ✅ |
| GraphQL API (auto-generated from Neo4j via `@neo4j/graphql`) | `packages/server/src/schema/` | mutations like `createWorkItems`/`createEdges` exist without hand-written resolvers |

## The ontology layer (Epic 7 — designed, not yet built)

One graph engine, many overlapping ontology sets (task management today;
requirements traceability with coverage reports next). Meta-model as data,
validated writes, MCP parity from day one. Full design:
[design/ontology-layer.md](./design/ontology-layer.md). Stories ONTO-1..5 +
AINAT-1..3 in [USER_STORIES.md](./USER_STORIES.md).

## Data model (Neo4j)

- **WorkItem** nodes (EPIC/MILESTONE/FEATURE/OUTCOME/TASK/BUG/IDEA/RESEARCH),
  **Edge** nodes joined to WorkItems by `EDGE_SOURCE`/`EDGE_TARGET` relations,
  **Graph** nodes (`BELONGS_TO`). Edge types: DEPENDS_ON, BLOCKS, IS_PART_OF,
  RELATES_TO, etc.
- Auth (users/sessions/OAuth) lives in **SQLite** on the server, which is why
  the server can boot in "auth-only mode" when Neo4j is unreachable.
- Local dev: `docker compose -f deployment/docker-compose.dev.yml up -d graphdone-neo4j`
  (neo4j 5.26.12, `neo4j`/`graphdone_password`, browser at http://localhost:7474).

## Where the rules live

- **[CLAUDE.md](../CLAUDE.md)** — working agreement, THE GATE, dev gotchas, story workflow
- **[USER_STORIES.md](./USER_STORIES.md)** — the backlog that drives development; every story maps to tests
- **[TESTING_AND_REFINEMENT_PLAN.md](./TESTING_AND_REFINEMENT_PLAN.md)** — the never-done improvement loop
