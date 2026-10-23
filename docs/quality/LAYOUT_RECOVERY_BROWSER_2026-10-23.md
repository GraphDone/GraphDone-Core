# Layout recovery needs a real navigation and server-readback regression

On 2026-10-23, the position queue fixes received a headed browser regression in `tests/e2e/smoke/user-smoke.spec.ts`. The existing `test:smoke`, unified smoke, and new-user gate include that file, so this case participates in the normal application gates.

The case creates its own graph, two tasks, and one edge through the real authenticated Core API. The graph ID is registered for strict edge-first cleanup immediately after creation. It holds only the first `UpdateWorkItems` request whose node and graph IDs match the fixture and whose update contains exactly `positionX` and `positionY`. All other requests continue normally. While that save is in flight, a second real mouse drag queues newer coordinates. The first request then receives exactly one HTTP 200 GraphQL error response.

The test selects Work list through the application’s view control, proves that the graph canvas unmounted, and reads the original coordinates from the API while no further layout request occurs. Returning to Graph must issue the newer coordinates, and the API and reloaded canvas must agree. This exercises the actual caller, Apollo response handling, provider lifetime, and server persistence beyond the rendered-hook tests.

## Recorded evidence

Command (Node 22.23.4, existing owned Core/Neo4j validation stack):

```sh
TEST_URL=http://127.0.0.1:13127 PLAYWRIGHT_BROWSERS_PATH=/tmp/graphdone-audit-playwright xvfb-run --auto-servernum npx playwright test tests/e2e/smoke/user-smoke.spec.ts --project=GraphDone-Core/dev-neo4j/chromium --grep 'failed layout save' --headed --workers=1 --retries=0 --trace=on
```

The focused run passed 1/1 in 13.3 seconds, with no retries. Its attached `layout-save-recovery.json` recorded original coordinates `(-240, 0)`, failed first-drag coordinates `(-180, 36)`, latest coordinates `(-120, 72)`, exactly two matching mutation attempts, exactly one injected failure, and server readback `(-120, 72)`. Reload and fixture cleanup assertions passed.

The first test-development run did not reach the failure scenario: its pointer coordinates were outside the viewport before camera framing completed, and its `/api/graphql` route missed the app’s direct `/graphql` transport. The corrected case waits for the owned card to be fully visible and stable, and matches both endpoint forms while retaining the exact layout-mutation predicate. A quiet simulation alone does not establish that the camera is ready for a real drag.

## Limits

This case tests one graph/account and a controlled GraphQL save failure. Account-switch/token races remain covered by separate unit and Apollo-link tests. It does not establish crash persistence, recovery after forcibly closing the tab, a genuine network disconnect, or hosted backend behavior. The focused pass is not a substitute for the combined application gate.
