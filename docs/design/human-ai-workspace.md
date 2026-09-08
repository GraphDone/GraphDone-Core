# Human-first workspace, observable AI work

Product direction clarified 2026-09-07: GraphDone is a friendly place for people to work and understand AI-driven development. Agents participate through clear, authenticated interfaces. Human control and understandable progress drive the interface; infrastructure and exhaustive controls stay secondary.

## Product boundary and current priority

Core remains the free, open-source foundation. A managed GraphDone web product can add advanced autonomous execution, LiteLLM gateway integration and external ChatGPT/OpenAI agent interfaces. Do not imply these services ship in Core today.

The current implementation priority is visual/UI/UX correctness across common resolutions and orientations. Minimize both button presses per task and the number of tasks required to reach an outcome. Primary work should be directly actionable; avoid intermediate read-only dialogs or unnecessary save/confirmation steps. Secondary configuration can expand on demand. Gateway and autonomous-execution implementation follows this UI work.

## Human questions the default experience must answer

- What is happening? Show active work, who or which agent is working on it, and the latest meaningful update.
- What needs me? Surface blockers, questions, review requests and decisions with a clear next action.
- What changed? Show progress and evidence since the person's last visit, with links to the work, tests, artifacts and discussions.

Keep the graph as a powerful exploration view. A phone should offer the same essential actions in a readable list and compact editor. Details, filters, history and configuration expand on demand. Never show fabricated agent activity, simulated progress, or an action that appears to succeed without persistence.

## Shared human/agent work contract

Use one authorized domain API behind UI and agent tools. Minimum operations:

1. Read a bounded work context: graph, requirements, dependencies, eligible work, current revision and caller permissions.
2. Claim eligible work atomically with actor identity, lease expiry and expected revision; reject competing claims. Humans can release/reassign within their permissions.
3. Append a progress event: actor, work item, status, plain-language summary, timestamp, evidence links and idempotency key. Retries must not duplicate history.
4. Report a blocker or ask a question; place it in the human's attention queue with a suggested next action.
5. Submit work for review with evidence and acceptance-check results; completion policy is explicit per graph. Do not equate an agent saying “done” with verified requirements.
6. Resume after reconnect using a durable event cursor/revision, including deletions and failed/abandoned claims.

Suggested vocabulary: `get_work_context`, `claim_work`, `report_progress`, `request_input`, `submit_for_review`, `release_work`. These names describe the desired contract, not currently shipped tools. Tools must be available over a hosted interface and use scoped credentials; local database access alone does not meet the online requirement.

## Observability without overload

A current-work summary points to a durable event history. Preserve who did what and why, distinguish reported from verified progress, and provide evidence without exposing secrets or dumping internal reasoning. Live transport can broadcast changes, but reconnects recover from durable storage. Cursor/presence updates are ephemeral; task status, blockers, review decisions and evidence are persistent.

## Acceptance scenarios

- A human creates a requirement and two tasks; an authorized agent finds and claims eligible work, reports an update, and submits evidence for review. The human sees the changes without reloading.
- Two agents try to claim the same task; exactly one succeeds, and the other receives an actionable conflict.
- An agent requests input; the human answers from a phone in portrait, and the agent can resume.
- A network retry repeats a progress report without duplicating history; reconnect restores missed updates.
- A revoked or cross-graph credential cannot read, claim or update work.
- At 320px portrait and short landscape, primary actions and the current result remain visible; controls, charts and metadata never displace the actual work. Keyboard navigation, reduced motion and assistive labels work.

These are release requirements. Existing CRUD, status notes, MCP and polling are useful foundations but do not by themselves satisfy this contract.
