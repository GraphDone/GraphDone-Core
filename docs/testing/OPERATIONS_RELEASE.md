# Operations release quality gate — 2026-09-08

Scope: feedback, operator review, scoped improvement access, production admin recovery and source-based VPS installation. This is evidence for this release slice, not a claim that every existing GraphDone screen or managed runtime is complete.

| ID / persona | Preconditions | Repeatable sequence | Expected result | Coverage |
| --- | --- | --- | --- | --- |
| OPS-01 / parent on a phone | Local hosted fixture; visitor | Open feedback, enter a bug, go offline, send, close, reload online, reopen, send | Draft survives; no false delivery; one persisted receipt | Headed 320×568, 390×844, 844×390, 1024×768, 1440×900, 2560×1440 |
| OPS-02 / student team member | Two signed-in fixture users | Submit, retry unchanged, retry altered, list from another account | Idempotent receipt; changed replay conflict; no cross-account reports | Same HTTP contract against Core SQLite and Worker/D1 |
| OPS-03 / operator | Real private admin credentials | Password login, submit QA feedback, open inbox, resolve, inspect history | Persistent report and one atomic revision event | Headed self-hosted and opt-in deployed acceptance |
| OPS-04 / improvement agent | Read-only token, then triage token | Read contract/reports/stats; try review and announcement; revoke; retry | Read scope cannot mutate; triage may review; neither can publish notices or issue tokens; revocation immediate | Shared HTTP contract and headed UI token creation |
| OPS-05 / large team | Synthetic owners, no inference | Concurrent submissions; competing review revisions | Exactly five daily reports admitted; stale review returns 409 | Real local SQLite and D1/DO |
| OPS-06 / shared-network visitors | Two people sharing anonymous IP | Submit anonymously, attempt anonymous report listing | Receipt only; no report listing for other people on the same network | Shared contract |
| OPS-07 / downgraded administrator | Signed token claiming ADMIN, current account USER | Read operator data and hosted GraphQL users | Denied based on current role | Shared ops and hosted GraphQL regression |
| OPS-08 / VPS operator | Fresh Docker volumes; generated private env | Build, start, log in, submit/review, restart with retained volumes | Healthy graph/API, usable admin, retained credentials/data | Docker Compose plus headed operator sequence; production bootstrap restart test |
| OPS-09 / unreliable model | Synthetic reports and fake inference | 100 malformed/foreign/stale/overprivileged actions; quota and conflict responses | No unauthorized write and no retry storm | Node contract tests, no external inference |
| OPS-10 / connected runtime | Installed Codex CLI | JSON-RPC initialize and initialized; terminate | Actual protocol handshake without a model turn | `scripts/test-codex-connection.mjs` |

Commands and private credential handling: [operations API](../api/OPERATIONS.md). VPS installation: [self-hosting](../deployment/SELF_HOSTING.md). Product boundary and runtime research: [strategy](../product/CORE_HOSTED_STRATEGY.md).

## Bounded gateway experiment

Exactly two serial calls used the existing `graphling-small` alias at gateway.graphlings.net, with synthetic local reports and temporary local triage tokens revoked afterward. No production reports or D1 writes were used for inference. First call: 8,769 ms, 544 tokens. Second call: 1,009 ms, 685 tokens. The second run required structured proposed steps, impact and expected behavior instead of accepting a generic finding.

Both calls passed action validation and local write-back. Semantic quality did not justify autonomous remediation: the first mostly repeated the report; the second proposed unclear steps involving a “phone button.” The resulting note explicitly says it is not reproduced or fixed. Keep a human review gate; do not treat structurally valid output as a useful investigation. The gateway alias does not identify the underlying provider. No cron, managed sandbox or recurring inference has been enabled.

Codex CLI 0.153.4 passed real App Server initialization and local JSON-schema generation. Claude Code 2.1.261 was present but no Claude model session was executed in this slice. Hermes was not installed. Documentation research is not runtime acceptance.

## Remaining gaps

Managed Codex/Claude/Hermes start/resume/stop, sandbox tenant isolation, run leases, budget termination, and artifact retention require their own acceptance gates. Core Neo4j offline-sync/project-transfer parity remains engineering debt. Hosted account suspension is explicitly unavailable, not a pretend successful mutation. Report/event retention is currently operator-managed. Hosting-provider marketplace packaging and a backup restoration drill remain separate from the successful fresh Docker installation.

## Verified release result

The headed real-password sequence passed against the clean self-hosted Docker stack and **https://graphdone.com**, including persisted feedback/resolution/history, aggregate usage, read-only denial and revocation after acknowledgement. The local anonymous/offline feedback sequence passed all six viewport sizes. The final Docker rebuild reused its persistent volumes and admin credentials successfully.

Live acceptance caught a public-IP quota preventing operator login. The hosted fix verifies the secret-backed password before routing recovery SQL through the existing system reserve. Operator-token lookup has a separate bounded public lane. Local Worker/DO regression exhausts the normal public-IP lane, preserves a legacy account using the `admin` username, and proves recovery plus scoped token reads without increasing the total cap. Invalid credentials do not reach the reserve. Browser tests wait for the server acknowledgement before asserting revocation; clicking a button alone is not acknowledgement.

Post-change local regressions passed: 410 requests in ten-way waves with exactly 400 admissions; owner isolation; restart persistence; sign-in reserve; cached reads; concurrent 300-task/600-link limits; two agent tokens sharing one owner's budget; offline create/task/edge/note sync; agent revision conflicts; atomic concurrent writes; and 2,000 full-length notes (8 MB) downloaded without an oversized D1 row. Bulk checks used local D1/DO only.

Published application source: Core `4b02f5f13b30383c01568ab340ec690c0d330ec4`; Pages artifact source Cloud `e86bdab720fd6944dd4a42df0912163c2898a9e4`. Pages deployment: `https://28463d8e.graphdone-cloud.pages.dev`. API recovery source: Cloud `e4690b0`; Worker version `b26c0fa3-d797-45ff-a9d8-4743e604338a`. D1 migration `0010_operations.sql` applied only after a successful private remote export. Later documentation/test-only commits do not change these published application assets.
