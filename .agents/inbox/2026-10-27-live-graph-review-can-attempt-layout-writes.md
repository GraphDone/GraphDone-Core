# Viewing a live graph can attempt layout writes even without dragging

Date: 2026-10-27 UTC. Searched the current performance-evidence index and the
October 24 semantic-review worktree's symptom index, write-it-down guidance and
read-only capture lessons before recording this finding.

## Evidence

The existing harness at `01f0c4df1ba82eaaca9769d366886c76b99f0e6b` ran:

```text
TEST_URL=http://127.0.0.1:8540 GRAPH_REVIEW_NAME='Graphlings Release' \
OPERATOR_CREDENTIAL_FILE=<existing private operator file> \
PLAYWRIGHT_CHANNEL=chrome \
GRAPH_REVIEW_OUT=test-artifacts/graph-lod-review/continuation-20261027 \
GRAPH_REVIEW_SNAPSHOT=1 npm run report:graph-lod

finishedAt=2026-10-27T14:56:23.996Z
nodes=301 edges=370 captures=18 pageErrors=[]
blockedWrites=4 (POST /api/graphql)
1 failed: Review attempted a server write; request was blocked, inspect caller
```

No drag, seed or graph-edit interaction was requested. Node/edge identity
assertions passed. Desktop and phone fit screenshots still show no readable
titles or relationships. Served asset: `/assets/index-1788931697531.js`; its
exact source SHA is not established by the harness revision.

A second bounded diagnostic installed API interception before login, permitting
queries and only the login mutation. It selected the same graph, waited, resized
to phone and fit the camera. It printed only operation/field names:

```text
blocked=4
operation=UpdateWorkItems
rootField=updateWorkItems
variableKeys=[where,update]
updateFields=[positionX,positionY]
```

That diagnostic exited 143 after printing; do not record it as a passing test.
The original sweep exited 1. Both failures remain explicit. Private screenshots
and the snapshot stay in the prior worktree's ignored artifacts directory.

## Cause and corrective rule

The application attempted automatic position persistence during a visual review.
Source has a `simulation.on('end.persist', ...)` → `persistAllPositions()` path;
the exact browser caller and affected graph were not captured, so that path is
a hypothesis, not a proved request stack. Do not attribute the request to zoom
alone or assume the selected graph was the mutation target.

Install the read-only guard before application navigation, allowing only the
intended authentication exchange and reads on the configured API origins.
Retain safe operation/field names for rejected calls, never tokens, payload values
or session state. An attempted write remains a failed review even when blocked.
Reproduce on an owned fixture before correcting persistence intent. Camera, LOD
expansion and temporary summary coordinates must not enqueue saved positions.

## Limits and regression path

The first sweep installs its guard after login, so its blocked-write evidence
does not prove there were no earlier writes. Identity-set equality does not prove
position equality or whole-graph immutability. The diagnostic blocked the four
observed position updates, but did not establish root-cause completion.

`tests/lib/graphReview.test.mjs` in the prior review branch passed 2/2 guard tests;
the real sweep supplies a failing acceptance case. LOD-0 in the
[continuation plan](../../docs/architecture/dynamic-graph-lod.md) ports and extends
that harness on current dev, with owned layout-persistence reproduction and
independent coordinate readback. No production fix or new passing regression is
claimed by this documentation-only change.
