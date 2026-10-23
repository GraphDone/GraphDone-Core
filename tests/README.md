# GraphDone tests

Run commands from the repository root. The canonical guide is
[Testing](../docs/testing/README.md); it describes the acceptance profiles,
evidence format, and their limits.

| Command | What it verifies |
| --- | --- |
| `npm test` | Package unit suites through Turbo; does not run browser acceptance. |
| `npm run test:unified:lib` | Report adapters, process outcomes, CLI safety, source provenance, and dashboard helpers. No browser or database required. |
| `TEST_URL=http://localhost:3127 npm run test:smoke` | Focused user smoke against an already-running disposable stack. |
| `TEST_URL=http://localhost:3127 npm run test:unified:smoke` | Web unit tests, user smoke, and focused authentication acceptance, with one combined report. |
| `TEST_URL=http://localhost:3127 npm run test:pr` | Broader graph, mobile, and performance sequences. |

Browser suites create, edit, and delete data. Start an owned disposable local
stack with test accounts and seeded data before running them. Never point the
ordinary smoke/PR suites at production or a shared developer database. Supplying
`TEST_URL` tells Playwright the stack is externally managed; it does not provision
or isolate that stack. Database-backed MCP suites additionally require their
explicit disposable-fixture configuration; see
[the MCP guide](../packages/mcp-server/README.md).

The test tree is organized as follows:

- `e2e/<domain>/`: user workflows; `e2e/smoke/user-smoke.spec.ts` is the focused gate.
- `lib/`: authentication, API, report adapters, runner, and dashboard helpers.
- `sequences/unified.config.mjs`: profile and sequence definitions.
- `diagnostics/` and `perf/`: specialized geometry and performance checks.
- `integration/`: infrastructure checks outside the default browser project.

An authenticated test under `tests/e2e/<domain>/` imports helpers with:

```ts
import { login, navigateToWorkspace, TEST_USERS } from '../../lib/auth';
```

Use the current helper and fixture configuration as the source of test account
details. A successful unit run or test listing is not evidence that a browser
workflow works. Report skipped, flaky, failed, and untested behavior explicitly.
