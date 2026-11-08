# Wait for a save acknowledgement before testing saved-state navigation

Date: 2026-10-23. Source baseline: `f6887577`. Related public tracking:
[issue #156](https://github.com/GraphDone/GraphDone-Core/issues/156).

## Evidence and cause

The first combined 41-case gate stopped after 10 passes and three failures. Two
recorded-AI fixtures invoked `createContributors`, which the reviewed security
schema intentionally removed. The 320px editing case clicked Completed and
forced a document navigation without waiting for the mutation. Analytics then
reported one completed item instead of two.

The contributor failure reproduced on the owned disposable Neo4j stack. Its
correct replacement uses nested contributor creation and deletion on the
authenticated user's own work item. Cleanup verifies that both fixture nodes
were deleted. The Agents page uses `pollInterval: 0` and exposes **Refresh agent
work**; the test now invokes that action before checking an external API update.

The original 320px test passed on repeat. Its trace recorded the genuine
`UpdateWorkItems` response with HTTP 200 in approximately 54 ms. A controlled
750 ms delay of that exact status request reproduced the original failure:
Analytics stayed at one completed item. The trace had no completed response for
the status request when the test performed a full document navigation
(`responseStatus: -1`).

## Corrective rule and checks

Before navigating to inspect saved state, observe the save acknowledgement.
The responsive test now selects the exact edited item and requested status,
requires HTTP success and no GraphQL errors, checks the returned COMPLETED
state and pressed control, and independently reads the status through the API.
It then performs the original navigation and still requires two completed
items in Analytics. The 750 ms delay remains in the 320px case as a regression;
no assertion timeout was increased and no expected value was weakened.

Focused command, using the Playwright browser revision installed for this lockfile:

```bash
TEST_URL=http://127.0.0.1:13127 xvfb-run -a npx playwright test \
  --project=GraphDone-Core/dev-neo4j/chromium --headed --workers=1 --retries=0 \
  tests/e2e/graph/recorded-ai-work.spec.ts \
  tests/e2e/graph/responsive-real-workflows.spec.ts
```

The nine focused browser cases passed headed, with one worker and zero retries,
on the disposable combined stack. Screenshots were inspected at 320px and
390px. The recorded-AI capture also brings the saved note into the viewport so
its image supplies direct progress evidence. `git diff --check` passed.

The fixture regression changes test synchronization and authorized fixture
setup. Application code and security controls are unchanged. This does not
establish durability when a user forcibly reloads before acknowledgement,
automatic agent execution, Cloud backend parity, or the live production build.
The full headed `npm run qc:new-user` gate remains required before promotion.
