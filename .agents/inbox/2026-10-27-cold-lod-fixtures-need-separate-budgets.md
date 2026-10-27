# Cold database fixture setup must not consume the browser interaction budget

Date: 2026-10-27. Searched the symptom index and the existing LOD ownership and
performance-evidence lessons. Final PR #192 CI at
`4abce30030e45e1e9d468c67e414302f270d45e9` failed the strict headed new-user
sequence even though the earlier focused local browser run passed.

## Evidence and cause

```sh
gh run view 40541503856 --repo GraphDone/GraphDone-Core --job 122322370157 --log-failed
gh run download 40541503856 --repo GraphDone/GraphDone-Core \
  --name smoke-results-e2599a1245884c450fd1635d89b92cc60871a033 --dir <owned-evidence-directory>
```

The basic smoke sequence passed 6/6. New-user reported 43 pass / 2 fail: one
desktop LOD case hit its 120-second whole-test timeout, and the second entry
was the harness's process-exit failure. The phone LOD case passed in 55.3s.
The trace records eight fixture mutation calls taking approximately 5.7–11.6s
each. Those calls consumed most of the shared setup/interaction budget on this
cold database. Navigation, graph switching and camera-restoration assertions
completed; the timeout interrupted the final source-position readback. That is
an incomplete persistence check, not a passing journey or proof of a renderer
hang. Cold query planning is consistent with the earlier local batch-size
incident; this trace does not separately profile the database planner.

## Corrective rule

Use a bounded Playwright fixture for expensive real API setup and teardown.
The LOD fixture gets 180 seconds per fixture phase; the interaction test keeps
120 seconds, 10-second actions and its existing assertion timeouts. Preserve
the 301-item / 370-edge graph, all assertions, and zero retries. Register owned
graph IDs immediately after creation so partial setup can be cleaned. Teardown
runs before the page closes, removes the write guard, deletes edges before
items/graph, verifies graph removal, and surfaces cleanup failures. A teardown
failure must fail the test, not silently leave fixtures behind.

## Limits

This isolates fixture provisioning from interaction correctness; it neither
improves measured application speed nor proves the large-graph performance
target. Rerun the complete strict CI sequence and record its actual result.
Raw CI artifacts are retained under the owned resolution evidence directory;
they are not added to the public repository because traces can contain fixture
sessions. The run link remains the canonical CI failure evidence.
