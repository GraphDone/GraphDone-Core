# Responsive acceptance must observe rendered controls and camera translation

Date: 2026-10-23. Existing guidance searched: `docs/quality/TEST_STRATEGY.md`,
`NEW_USER_GATE.md`, and prior responsive/browser reviews. Public tracking: #156.

The strict combined run on `aece6797ef61b21665c924762fb8c9ff68870c3a` failed five
cases because tests selected controls by width alone, dragged a locked compact
canvas, measured animated card corners as motion, or expected the graph to be
centered behind reserved control space. A sixth details-save failure is a
separate product race and is not corrected by this test patch.

A first focused revision passed 6/8: immediate visibility probes ran before
workspace navigation rendered, choosing the hidden desktop control on phones.
Wait for visible navigation before selecting its branch; bound individual
navigation actions so a failure does not consume the whole fixture timeout.

On 2026-10-23 the final functional patch ran against the unchanged combined
application, using Node 22.23.4, bundled Chromium, localhost, owned Neo4j fixtures,
one headed worker, and zero retries:

```text
TEST_URL=http://127.0.0.1:13127 QC_API_URL=http://127.0.0.1:14127/graphql \
xvfb-run --auto-servernum npx playwright test \
  tests/e2e/quality/button-content.spec.ts \
  tests/e2e/quality/graph-motion.spec.ts \
  tests/e2e/quality/graph-resize.spec.ts \
  tests/e2e/quality/new-user-modes.spec.ts \
  --project=GraphDone-Core/dev-neo4j/chromium --headed --workers=1 --retries=0
8 passed (2.5m); 653 buttons inspected, 0 content failures
```

Corrective rule: wait for actual rendered navigation, verify Editing before a
real drag, measure SVG screen translation separately from decorative scaling,
and require every resize to move the camera while leaving persisted world
positions unchanged. All two fixture cards must remain inside the graph and
clear of visible controls across 12 growth/shrink/rotation steps. Keep drag
persistence, all-view saved-data assertions, and the 17-second motion limits.

Limits: the motion sample is shorter than the 60-second poll interval; it does
not establish full-poll stability. Browser emulation does not establish native
mobile-keyboard or assistive-technology behavior. These eight passes do not
substitute for the complete strict new-user gate or establish deployment health.
Failed and passing logs/screenshots are retained under the owned worktrees'
ignored `test-artifacts/audit-20261023/` directories; PR review records carry
public progress. The final wording-only corrections clarify these limits.
