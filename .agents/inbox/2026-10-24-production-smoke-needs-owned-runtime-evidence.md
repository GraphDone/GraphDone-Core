# Production smoke must prove its own stack, identity and data

On 2026-10-24, issue #189's main-release review found that the old `prod-smoke`
job started Compose in the background, accepted any HTTP response from `/health`,
and used `admin/graphdone` against production's randomly generated admin password.
The raw Playwright command also inherited two CI retries. Passing dev CI had not
executed this main-only production path.

The new `scripts/test-production-stack.mjs` requires clean committed source and
owns a unique disposable Compose project. It builds synchronously, checks real
API and Neo4j health through nginx/TLS, authenticates its generated admin, and
creates and independently reads back two tasks and their edge. Confirmed cleanup
preserves edge → task → graph ownership order. The SQLite recreation checks and
six existing browser smoke cases must then pass; build, startup, readiness,
fixture, skipped/flaky browser evidence, source changes and cleanup failures are
failures of the gate.

The bounded regression command is:

```sh
node --test tests/lib/runner/production-stack.test.mjs
# tests 11
# pass 11
# fail 0
```

These include real CLI subprocesses with deliberately failing fake Docker
build/start commands, verified project cleanup, generated-secret redaction and
rejection of dirty source before Docker is invoked. Negative controls reject
HTTP 502, static HTML, missing health services, unhealthy Neo4j, wrong saved IDs,
failed child cleanup, external/shared resources and incomplete credential
overrides. This is harness evidence, not a production-stack pass. The broader
Node 22 harness run in this uninstalled worktree was 171 passed / 1 failed: the
dependency regression could not resolve `@typescript-eslint/typescript-estree`.
The installed combined candidate must rerun that full check.

The corrective rule is to bind acceptance to the exact source and a runtime it
owns, then require functional evidence beyond a responding web server. The
runner changes test isolation inputs only: generated names, local image tags,
private certificates, removed developer `.env` mounts, and a random loopback web
port. Empty frontend URL build arguments select the existing same-origin proxy
fallback so that random port is usable. The actual SQLite target and application
code remain under test. No broad demo seeding or existing database is used.

Limits: generated secrets and Compose configuration stay outside artifacts and
are removed; console logs redact known generated secrets and JWTs. Raw retained
Playwright traces can contain the disposable account's credentials and network
bodies and must not be published unreviewed. The runner removes its containers,
volumes and networks, retaining local image tags for cache/evidence. It neither
publishes images nor deploys anything. Full-stack evidence must come from a
separate completed run and must name its exact candidate and report.

## Public evidence excludes raw network traces

On 2026-10-24 UTC, independent review found that the initial CI directory upload
also included raw failure traces. Those traces can contain the disposable admin
password or token even though stage text logs redact them. The upload now allows
only `run-*/report.json` and `run-*/*.log`; nested smoke reports, ZIP traces and
screenshots stay local. The new workflow regression failed once against the
broad upload (28 other cases passed), then all 29 cases passed with the allowlist.
This preserves public stage outcomes/counts and source/cleanup evidence, not
full per-case raw diagnostics. Runtime, retries and smoke assertions are unchanged.
