# GraphDone: human work with dependable agent check-ins

Decision record, 2026-09-08. This supersedes older "pet agent", graph-as-agent-dashboard and enterprise-feature-gating proposals. The primary object is the person's work: what matters next, what is moving, and what needs their answer. A graph is an optional useful view of relationships, not a prerequisite for managing agents.

## Product boundary

| Capability | Core: free, open source, self-hostable | Hosted service |
| --- | --- | --- |
| Projects, tasks, priorities, relationships, notes | Full working product | Same product |
| Portable data, backup/restore, agent protocol | Open formats and interfaces; no artificial export restrictions | Managed persistence, backup operations and cross-device convenience |
| Feedback inbox, admin review, operator API | Same shared implementation; SQLite storage | D1 storage, quota admission, service operations |
| Bring an agent or inference gateway | Documented open API, scoped credentials, open runner examples | Guided setup and managed connections |
| Agent execution | Run adapters/runners on your own hardware/VPS | Optional managed per-tenant sandboxes, resumable sessions, scheduled work and usage support |
| Limits | Hardware and operator-configured safeguards | Published allowances tied to actual infrastructure/inference cost |
| Payment | No paywall for the collaboration primitives | Pay for saved setup/maintenance effort, hosted resources and operational guarantees |

The paid edition must not depend on hiding essential task or agent capabilities from Core. Providers should be able to offer Core hosting. We should earn subscription revenue by being the easiest, most dependable place to use it. Hosting-provider marketplace listings are separate publishing work: a Docker Compose installer is not a claim of Hostinger marketplace availability.

## Human-facing interaction

1. A person writes an outcome or marks a task ready for help.
2. A connected agent reads the project's priorities and recent notes using a scoped token.
3. It posts a short plan/check-in, works within its permitted environment, and records evidence or an artifact.
4. If it needs a decision, it leaves one clear question and marks the task blocked. If it produced a result, it requests review.
5. The person answers or accepts the result in the existing task/notes interface. Provider, session, model, runner health and token controls sit behind details.

Never say "working" just because a process exists. A useful check-in says what changed, what remains, and whether the human must act. Never mark work complete merely because the model's turn ended. A task completion must carry evidence appropriate to the task. A runtime failure or budget stop becomes a visible check-in, not disappearance.

## Four distinct layers

- **Work and coordination:** GraphDone projects/tasks/notes, feedback reports and the relevant scoped APIs. Independent of model vendor.
- **Inference:** LiteLLM or a direct provider. This is a model gateway, not a process/session manager.
- **Execution adapters:** Codex, Claude Agent SDK, Hermes or another runner. Translate runtime events into short task check-ins and preserve runtime session IDs privately.
- **Hosting/control:** tenant identity, run leases, secrets, queues, VM/container lifecycle, persistence, limits, stop/resume and audit. This is where hosted convenience earns its price.

Keep D1 for compact application/coordination state. Do not stream every token, terminal line or screenshot into D1. Buffer events in the runner, write meaningful state transitions, and store large artifacts/transcripts in suitable file/object storage with a retention policy. Existing usage counters remain outside D1; an admin overview reports our measured admission/circuit-breaker totals, not an invented Cloudflare billing balance.

## Verified runtime interfaces and integration choice

**Codex:** App Server exposes initialized connections, threads and turns, including thread resume. The SDK provides programmatic integration. A private adapter can preserve the thread/session reference and send progress/approval events to GraphDone. The app server should sit behind our authenticated control plane inside the tenant's execution environment. We must test the installed schema rather than assume a CLI version supports every documented method. Sources: [App Server](https://learn.chatgpt.com/docs/app-server), [SDK](https://learn.chatgpt.com/docs/codex-sdk).

**Claude:** The Agent SDK hosting example separates process, session and container, and describes durable session storage plus routing/spawn/lifecycle responsibilities. Start with one controlled container per tenant/run and persistent session data. A plain example HTTP server is not a production authentication boundary. Resume sessions through the adapter; map genuine tool outcomes to work-item notes. Source: [Anthropic hosting guide](https://platform.claude.com/cookbook/claude-agent-sdk-07-hosting-the-agent).

**Hermes:** Its authenticated API offers session operations, event streaming and capability discovery. Profile routing has its own key boundaries. The server exposes powerful tools, including terminal execution, so GraphDone should talk through a private adapter, not give a browser a general runtime key. Detect capability/version support before enabling controls. Source: [Hermes API server](https://hermes-agent.nousresearch.com/docs/user-guide/features/api-server/).

**LiteLLM:** Virtual keys support model restrictions, budget and concurrency/rate constraints. Put provider credentials in the runner/control plane, not the static SPA or task notes. Use a separate constrained key per hosted tenant or workload; record which model alias was actually used. A gateway alias does not establish whether the underlying provider is OpenAI, Anthropic or a local model. Source: [LiteLLM virtual keys](https://docs.litellm.ai/docs/proxy/virtual_keys).

These are integration findings and architecture decisions, not claims that GraphDone already hosts all three runtimes.

## Iterative acceptance gates

| Stage | Deliverable | Evidence required before enabling it |
| --- | --- | --- |
| Operations foundation | Reports, human admin, scoped improvement access, usage overview | Same contract against Core SQLite and Worker/D1; headed reporter-to-review journey; token denial/revocation; stored audit |
| Bounded collaboration | Open runner reads work/reports and produces a useful check-in | Synthetic local fixtures, strict action validation, small serial gateway calls, one failed/blocked run made visible |
| Bring-your-own running session | Private Codex/Claude/Hermes adapters | Real session start/resume/stop; reconnect without duplicate notes; cross-tenant denial; secrets never in browser payloads |
| Managed execution | Queue + lease + isolated sandbox per tenant/run | Competing claim test, lease expiry, process crash, budget stop, egress boundaries, persistent work recovery, operator kill switch |
| Hosted paid experience | Guided setup, managed storage/backups and execution allowance | Published pricing/limits, cancellation/export, backup restore drills and a human-first usability test |

Do not build a marketplace of nonfunctional buttons. Expose only capabilities proven by the connected runtime. Keep explicit gaps in the release ledger. The current Neo4j Core and hosted D1 paths still need parity work on offline sync and portable transfers; that is engineering debt to close, not a monetization strategy.
