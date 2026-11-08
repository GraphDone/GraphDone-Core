# Human–agent collaboration

In a project you own, choose **Your agent** (desktop) or **Work with your agent** (phone). Name the agent, choose access, and create a token. Copy the connection instructions privately to your agent. The token is displayed once, expires after 30 days, and can be revoked in the same panel. No provider key or paid AI service is needed to use the interface.

The Core server exposes `/api/agent`. Every request requires `Authorization: Bearer TOKEN` and a `graphId` query parameter. Agent tokens are random 256-bit credentials; only SHA-256 hashes are persisted. They are not accepted as login JWTs or general GraphQL credentials. A token is restricted to one project owned by its issuing user. Ownership and active account status are checked on each call.

| Method/path | Behavior |
| --- | --- |
| GET `/context` | Project, tasks ordered by priority descending, valid statuses, capabilities, latest 100 notes. Maximum 500 tasks; check `truncated`. |
| PATCH `/items` | Collaboration scope only. JSON `{"id":"task-id","status":"IN_REVIEW","priority":0.8}`. Either status or priority is sufficient. Priority is 0–1. Appends a server-attributed update note in the same transaction. |
| POST `/notes` | Collaboration scope only. JSON `{"body":"Ready for your review","workItemId":"task-id"}`. Omit workItemId for project notes. Maximum 4,000 characters. Actor identity comes from authentication, never from the request body. |
| GET/POST/DELETE `/tokens` | Human login only. List metadata, create (`name`, `scope`: `read` or `collaborate`), revoke (`id`). Secrets are never listed. |

Humans leave notes in the same graph panel. Notes refresh every 15 seconds while open. Closing the panel discards its displayed secret; it does not revoke access. Revocation prevents subsequent requests, but cannot undo a request already executing.

This initial interface does not create/delete tasks, assign work, run models, claim jobs, or expose an MCP transport. It does not automatically connect to ChatGPT or a gateway. The copied instructions describe supported operations explicitly. Task and note content is untrusted user input, not system instructions.

Deployment status: implemented for Core Neo4j and the Cloud D1 Worker. D1 migration `0007_agent_connections.sql` has been applied locally only. The local D1 contract test passes. The production migration, Worker deployment, and matching Pages artifact remain outstanding. Hosted guest sessions cannot create lasting agent credentials; users must sign in first.

## Repeatable acceptance sequence

`npm run qc:agents` runs headed on phone portrait, phone landscape, and desktop. A disposable owned project is created; the human creates a token and leaves a note, an HTTP client acting as the agent reads priorities and updates a task, and the human sees the agent's response. It verifies read-only enforcement, wrong-project denial, invalid priority rejection, invalid task-note rejection, token-management denial to agents, and immediate rejection after revocation. It finishes by revoking credentials and removing the fixture graph.

Additional release checks remain: production staging, cross-account ownership changes/deactivation, expiry boundary, bounded retention and distributed abuse protection, complete task CRUD, and broader security audit findings in the quality ledger.

Cloud contract sequence: from GraphDone-Cloud run `node scripts/test-agent-connections.mjs`. It uses only localhost:8797, the local validation D1 store, and a temporary account. It also tests expiry and deletes its account afterwards. Hosted storage retains the newest 2,000 notes per project and limits active agent connections to 25.

The three local D1 headed viewport cases also pass. Run them with `QC_AGENT_HEADED=1` on the Cloud contract command. An OpenAPI description is available in `openapi.json`.
