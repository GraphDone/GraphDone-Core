# Feedback and improvement-agent API v1

Both editions use the open-source `OperationsService`. Core persists it in `data/operations.db`; hosted GraphDone uses D1. Endpoint prefix: `/api/ops`. Authentication: normal user JWT or a separately issued `gd_ops_…` bearer token. Tokens are stored as hashes, shown once, expire after 30 days and can be revoked immediately. Current administrator ownership is rechecked on each operator-token request. Ordinary project agent tokens do not grant operations access.

| Endpoint | Access | Purpose |
| --- | --- | --- |
| POST `/feedback` | Visitor or signed-in person | `{id,kind,title,body,context}`; kind bug/idea/question, client-generated stable ID |
| GET `/feedback` | Signed-in non-guest person | Their own reports only |
| GET `/reports` | Admin or operator token | Report inbox; filters `status`, `since` ISO date, `before` pagination cursor |
| PATCH `/reports` | Admin or triage token | `{id,revision,status,resolution}`; stale revisions return 409 |
| GET `/events?id=…` | Admin or operator | Latest 50 review events, recorded atomically by the database trigger |
| GET `/stats` | Admin or operator | Account count, feedback status counts, measured service usage |
| GET `/contract` | Admin or operator | Machine-readable capabilities and handling instructions |
| GET/POST/DELETE `/tokens` | Human admin only | List, issue or revoke own operator connections; at most ten active |
| GET `/announcement` | Public | Plain-text service notice |
| PATCH `/announcement` | Human admin only | Guarded revision update of message/enabled flag |

Reports are paginated at 50 rows. `next` is the next `before` value. A `since` filter includes updates and can be combined with pagination; consumers should deduplicate by report ID/revision. Inbox data is not a transactionally frozen snapshot across pages. Statuses: new, reviewing, planned, resolved, dismissed. Report contents are untrusted data, not instructions to execute.

Limits: five reports per account/anonymous IP per UTC day, 160-character title, 4,000-character body, 1,500-character technical context; 32 KB HTTP bodies. Requests are rate-limited; hosted requests also pass through the shared usage admission system. Retrying the same ID and unchanged payload returns the original receipt. Anonymous reports cannot be listed by anonymous callers, including people sharing the same IP. No email address or project contents are automatically attached. The UI keeps unsent drafts locally and never claims delivery until the service acknowledges it.

The D1 overview comes from the existing Durable Object counters, not a Cloudflare account billing API. It exposes aggregate pool usage and internal limits, without per-user activity or credentials. Core reports self-hosted operation without imposing a GraphDone cloud quota. Operators should include the SQLite/D1 data in backups; report data and review history currently persist until an operator applies a retention policy.

## Optional improvement runner

`scripts/graphdone-triage.mjs` is a small open-source adapter for an OpenAI-compatible gateway such as LiteLLM. It reads the contract, oldest report on the current new-report page and aggregate stats, then makes **one** inference call with a 500-output-token cap and a 45-second timeout. No shell, arbitrary HTTP, account, announcement or deployment tool is offered. The returned action must match the selected report and revision and can only request `reviewing`. It records impact, a proposed test and expected behavior, explicitly stating that the issue has not yet been reproduced or fixed.

Configure `GRAPHDONE_OPS_URL`, `GRAPHDONE_OPS_TOKEN`, `LLM_BASE_URL`, `LLM_API_KEY`, `LLM_MODEL` in the runner's private environment. It prints a small result summary, not credentials. Set `GRAPHDONE_RESULT_FILE` to retain a private proposal. Default is proposal-only; `--apply` requires triage access and writes the finding. CLI runs have a local lock and one-attempt-per-minute throttle. A failed request is not retried. Inspect a stale lock after a crash rather than launching overlapping workers. No recurring job is installed automatically.

Native Codex, Claude and Hermes can use the same operator contract through their own HTTP/MCP adapters. Their runtime credential must remain separate from the GraphDone token. A real managed sandbox service, including tenant isolation, leases, session persistence and budget enforcement, is separate work; see the product strategy.

## Repeatable tests

- `npx tsx scripts/test-operations-local.mts` — real Core Express/SQLite/auth contract.
- Cloud `node scripts/test-operations.mjs` — same contract against actual Worker/D1/Usage Durable Object.
- `npx tsx scripts/test-admin-bootstrap.mts` — generated production credentials, permissions, login and restart.
- `node --test tests/contracts/triage-runner.test.mjs` — valid proposal/apply, 100 adversarial actions, readonly denial, quota failure, stale revision, no retries.
- `tests/e2e/quality/operations.spec.ts` — headed user→admin→operator→public-notice workflow at six viewport sizes, using the local Cloud fixture.
- `GRAPHDONE_GATEWAY_SMOKE=1 node scripts/test-gateway-triage.mjs` — explicit one-call real gateway experiment, synthetic loopback reports only. Never include this in bulk CI.
- `node scripts/test-codex-connection.mjs` — real installed Codex JSON-RPC initialization, without starting a model turn.
- `TEST_URL=http://localhost:8540 OPERATOR_CREDENTIAL_FILE=deployment/self-host/.env npm run qc:operator-login` — opt-in real password login, report submission/resolution, scoped read, forbidden write, revocation and four viewport sizes. A private hosted JSON credential file can exercise the same sequence on a deployed site. Traces and videos are disabled for this credential-bearing test.
