# Mobile audit controls must target owned content and observable dismissal

Date: 2026-10-23. Existing guidance searched: the responsive acceptance lesson,
`docs/quality/TEST_STRATEGY.md`, and `tests/lib/mobileAudit.ts`. Tracks #156.

The existing CI mobile selection ran on combined source `aece679` with one headed
Chromium worker, zero retries, and a diagnostic stop after three failures:

```text
npx playwright test --grep='@mobile|@audit' --project=GraphDone-Core/dev-neo4j/chromium --headed --workers=1 --retries=0 --max-failures=3
15 passed, 3 failed, 9 did not run (3.4m), exit 1
```

The edit-dialog test selected an obsolete grid wrapper in an arbitrary default
graph. The create-dialog selector matched both a hidden desktop button and the
visible mobile button; its expected heading was also obsolete. The navigation
test pressed Escape (which closed More), then blindly clicked the underlying
page at fixed coordinates, opening a work item and blocking the next nav click.

The two dialog cases now create their own graph and named task, select actual
visible controls/current headings, retain every viewport/paint-order assertion,
and clean up only that graph's fixture. The navigation case asserts that Escape
hides More, removing the blind follow-up click and swallowed keyboard failure.

The final functional patch ran against the unchanged application on
2026-10-23, Node22.23.4, bundled Chromium, localhost API/owned Neo4j:

```text
TEST_URL=http://127.0.0.1:13127 QC_API_URL=http://127.0.0.1:14127/graphql xvfb-run --auto-servernum npx playwright test tests/e2e/mobile/dialog-positioning.spec.ts tests/e2e/mobile/experience.spec.ts --project=GraphDone-Core/dev-neo4j/chromium --headed --workers=1 --retries=0
4 passed (35.5s), exit 0
```

Corrective rule: own mutable fixtures, observe the visible control, and assert
dismissal before the next action. Coordinates without a current target can
activate newly exposed content. Keep failed evidence; a focused pass does not
count the nine unexecuted mobile cases as passing. Final combined mobile CI is
still required. This emulated browser evidence does not establish native mobile
keyboard or screen-reader behavior. Logs/screenshots are retained in the owned
worktrees' ignored `test-artifacts/audit-20261023/` directories and summarized in
public review comments.
