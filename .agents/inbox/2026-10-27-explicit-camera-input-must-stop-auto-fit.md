# Explicit camera input must stop pending automatic framing

On 2026-10-27, [PR #192 CI run 40567753567](https://github.com/GraphDone/GraphDone-Core/actions/runs/40567753567)
tested feature head `74c122d17897d61272e056df02a7957a686f2e2a` on GitHub's merge
composition `f7dd01a57766ff1919237c9852cabfd5130d6eac`. Fixture setup no longer
exhausted the interaction timeout, but both semantic LOD cases failed their
first requested camera scale: expected 0.5, observed 0.1379447032 at 1440px
and 0.0720887246 at 390px. The basic smoke sequence passed 6/6; new-user had
42 passes, two LOD failures and the harness's failed-process evidence row.
This is a distinct application race, not the earlier fixture-budget failure.

## Cause and corrective rule

Initial auto-fit samples the settling layout every 250ms. Canvas pointer/wheel
input stopped that loop, but the minimap's explicit camera functions only set
`cameraManuallyPositionedRef`. Because the minimap is outside the canvas, a
pending fit could overwrite its requested zoom. Overview inspection had the
same omission. Explicit pan, zoom and item inspection now mark the current
graph as framed; direct D3 source events do so too. Programmatic automatic
fit/restore still does not claim manual intent. The existing graph ID guard
keeps this ownership scoped to the current graph.

The first warm local negative control passed, showing that ordinary timing
was insufficient to reproduce the CI race reliably. The browser regression
now pauses the browser clock before graph loading, advances through the first
fit at 350ms, requests the minimap zoom, then advances six 250ms intervals
while checking the camera remains at 0.5. It resumes real time for the remaining
mouse/touch/navigation and persistence checks. It does not extend timeouts,
add retries, wait for auto-fit to finish, or bypass the production camera path.

With the strengthened test, restoring the unmodified component from
`74c122d` caused the desktop case to fail at the camera-stability assertion;
restoring the fix passed the same case. Both ordinary desktop/phone cases
also passed before clock control. Commands used Node 22.18.0, an owned
Neo4j/API/Vite stack, and headed Playwright with one worker and zero retries.
Final two-viewport, related camera/resize/detail and CI results are recorded in
the PR discussion; this lesson alone does not claim those pending gates pass.

Limits: these checks cover camera intent and immutable stored positions on the
301-item fixture. They do not establish full multilevel semantic projection,
1k/10k performance, hosted behavior or deployed-source identity. Preserve the
original failed CI artifacts and the warm negative-control pass alongside the
deterministic failure; a later green run must not erase either observation.

Independent review identified a lost initial-fit geometry sample after moving
zoom earlier. The test now checks font size, viewport bounds and card overlap
both at the first automatic fit and after explicit zoom, retaining both samples
in its geometry attachment. Clock control keeps the first sample from waiting
out the pending fit loop.
