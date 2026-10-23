# Runtime upgrades must be tested through startup and owned browser fixtures

Date: 2026-10-23. Tracks GraphDone/GraphDone-Core#156 and the audit integration in #157. Baseline source: `a6d2d4138daf31fb07d8727fc33779a9bfdb1404`.

## Findings and corrective rules

Production `npm audit --omit=dev --json` initially reported 9 high and 1 critical advisory. Compatible lockfile updates remove vulnerable transitive versions; Apollo Server moves from its retired v4 line to v5 with the supported Express 4 integration. The pinned `@graphql-tools/utils` 12.1.0 override patches nested instances, including Neo4j GraphQL dependencies. That dependency family requires a newer Node runtime: the project now requires Node 22.18+, with CI on the minimum and Node 24, and Node 22 containers/installers.

A build was insufficient evidence of runtime compatibility. After the initial install, the API failed to start because the hoisted Express integration could not resolve a peer installed inside the server workspace. Declaring the shared Apollo dependency at the root fixes resolution with the existing legacy-peer-deps installation policy. Validate a clean lockfile install, real API startup, and browser flows after dependency changes.

The existing MCP CI contract job failed because it lacked the explicit disposable-database marker required by its destructive test guard. Set that marker only for the job-owned Neo4j service. Never set it for shared developer or production databases.

The first headed smoke run passed 4/5 cases: the rendering case assumed the default graph contained nodes. The screenshot showed a valid empty Welcome graph. Rendering and layout cases now create their own two-node, one-edge fixture and delete only that fixture afterward. Required grow/layout assertions no longer silently skip, and navigation failures are not swallowed. Empty-graph behavior remains separately exercised.

## Recorded validation

Commands below ran in an isolated worktree on Node 22.23.4, with a separately owned Neo4j 5.26.12 container on ports 17474/17687 and a development API/web stack on 14127/13127. Credentials were generated locally and are omitted.

| Command/check | Observed result |
| --- | --- |
| `npm ci --legacy-peer-deps` | Clean install succeeded; final lockfile install repeated before review. |
| `npm run test` | 434 passed across core/web/server/MCP; 25 DB-gated cases skipped in the default MCP run. |
| MCP `RUN_DB_CONTRACT=1 GRAPHDONE_DISPOSABLE_NEO4J=1 npx vitest --run tests/neo4j-contract.test.ts` | 8/8 passed against the owned real database. |
| `npm run build` and `npm run lint` | All packages built; zero lint errors, existing warnings remain. |
| API `/health` | API started and Neo4j reported healthy after peer-resolution correction. |
| Headed Chromium `tests/e2e/smoke/user-smoke.spec.ts --workers=1 --retries=0` | 5/5 passed with owned fixtures (1.5 minutes). |
| `docker build -f packages/server/Dockerfile` | Fresh Node 22 Alpine lockfile install and API/core build succeeded. |
| `npm audit --omit=dev --json` | 0 high, 0 critical, 8 moderate as of 2026-10-23. |

Local ignored logs live under `test-artifacts/audit-20261023/`; public PR checks and review comments carry subsequent commit-specific results. These local results precede the other audit branches and must not be presented as integrated or deployed validation. Full dependency audit still includes development-tool advisories; production audit alone is not a security audit. Container build does not prove a deployed image works. Installer changes were syntax/config checked, not installed onto another person's machine.

The first remote Node 22 run caught an existing harness command incompatibility: `node --test tests/lib/` treats the directory as a module on Node 22. A quoted recursive test-file glob runs all 105 cases successfully. Both minimum-Node and Node 24 CI matrix jobs now execute the harness tests too. Static lint and typechecking had passed; the failed harness invocation was not counted as a pass.

## CI requirements

All PR bases now trigger CI. Locked installs replace mutating installs. Unit jobs build their workspace dependency first, the harness library regressions run in CI, and smoke runs through the strict evidence adapter. High/critical production dependency advisories now block CI Success. The broader headed new-user, mobile, graph, and performance gates remain enabled. Protected branch approval requirements remain in force.

References: [Apollo Server migration](https://www.apollographql.com/docs/apollo-server/migration), [Node release schedule](https://nodejs.org/en/about/previous-releases). See [testing guidance](../testing/README.md) for evidence limits and [quality guidance](RUNBOOK.md) for user-level validation.
