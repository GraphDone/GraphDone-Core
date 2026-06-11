# GraphDone for AI Agents — 5-Minute Quickstart

GraphDone treats AI agents as first-class teammates: anything a human does in the UI, an agent can do through the MCP server or the GraphQL API. This page gets an agent working against a running GraphDone in under five minutes. (Story AI-3 in [USER_STORIES.md](../USER_STORIES.md).)

## 1. Prerequisites

A running GraphDone stack (`./start dev` from the repo root), which gives you:

- GraphQL API: `http://localhost:4127/graphql`
- Neo4j: `bolt://localhost:7687` (`neo4j` / `graphdone_password`)
- MCP server: built from `packages/mcp-server`

## 2. Connect Claude Code (or any MCP client)

```bash
cd packages/mcp-server && npm run build

# Register with Claude Code
claude mcp add graphdone -- node /absolute/path/to/GraphDone-Core/packages/mcp-server/dist/index.js
```

Environment variables the MCP server reads (defaults work for local dev):

```bash
NEO4J_URI=bolt://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=graphdone_password
```

## 3. Orient in one call

`get_graph_context` is designed as an agent's **first call** — a compact (<2kB) summary instead of paging through nodes:

```jsonc
// tool: get_graph_context  args: { "graphId": "<id from list_graphs>" }
{
  "context": {
    "graph": { "id": "…", "name": "Sprint 12", "status": "ACTIVE" },
    "counts": { "nodes": 42, "edges": 31, "byType": { "TASK": 28, "BUG": 6 }, "byStatus": { "IN_PROGRESS": 9, "BLOCKED": 3 } },
    "topBlockers": [{ "id": "…", "title": "Fix auth", "blocksCount": 3 }],
    "recentActivity": [{ "id": "…", "title": "Polish UI", "status": "IN_PROGRESS", "type": "TASK", "updatedAt": "…" }]
  }
}
```

## 4. The working vocabulary

| You want to… | Tool |
|--------------|------|
| Find graphs | `list_graphs`, `get_graph_details` |
| Orient fast | `get_graph_context` |
| Read work | `browse_graph` (by type/status/contributor/priority/search), `get_node_details` |
| Create/update work | `create_node`, `update_node`, `delete_node` |
| Wire dependencies | `create_edge`, `delete_edge`, `find_path` |
| Plan at scale | `bulk_operations` (mixed creates/updates/connects in one call) |
| Understand priorities | `get_priority_insights`, `update_priorities`, `bulk_update_priorities` |
| Understand people | `get_workload_analysis`, `get_collaboration_network`, `get_contributor_availability` |
| Health-check a plan | `analyze_graph_health`, `get_bottlenecks` |

Node types: `TASK`, `BUG`, `FEATURE`, `EPIC`, `MILESTONE`, `OUTCOME`, `IDEA`, `RESEARCH`. Statuses include `PROPOSED`, `ACTIVE`, `IN_PROGRESS`, `BLOCKED`, `COMPLETED`. Edge types include `DEPENDS_ON`, `BLOCKS`, `ENABLES`, `RELATES_TO`, `CONTAINS`, `PART_OF`.

## 5. GraphQL for everything else

The full schema (auto-generated from Neo4j by `@neo4j/graphql`) is introspectable at `/graphql`. Auth is JWT:

```bash
TOKEN=$(curl -s -X POST http://localhost:4127/graphql -H 'Content-Type: application/json' \
  -d '{"query":"mutation { login(input: {emailOrUsername: \"admin\", password: \"graphdone\"}) { token } }"}' \
  | jq -r .data.login.token)

curl -s -X POST http://localhost:4127/graphql \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"query":"{ workItems(options: {limit: 5}) { id title status type } }"}'
```

## 6. Agent etiquette

- Call `get_graph_context` before mutating anything — orient first.
- Use `bulk_operations` for plans with more than ~3 items; don't spam single creates.
- Set meaningful `description` fields — humans read what you write.
- Agent-created items are attributed (story AI-5); never impersonate a human contributor.

## Roadmap for this surface

Tracked in [USER_STORIES.md](../USER_STORIES.md) Epic 4: capability-parity checklist (AI-1), machine-readable error contract `{code, hint, retryable}` (AI-2), agent attribution badges (AI-5).
