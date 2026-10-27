# Idle motion sampling must wait for completed edits and camera resize

Date: 2026-10-27. Issue #208. The symptom index already covers explicit camera
ownership and LOD transition interruption, but neither establishes when a rotated
viewport is ready for an idle-motion measurement.

## Evidence

OAuth PR #202 CI run `40597251568` failed the phone motion case with a horizontal
span of `185.395922` pixels against the unchanged one-pixel bound. Its retained
trace and 1,021 frame samples show one common camera transform change at sample
index 2, followed by 1,019 identical frames. Source-node coordinates stayed
unchanged. Sampling began about 6.8 ms after viewport resizing returned, before
the queued ResizeObserver/frame callback completed. The preceding type edit was
also still pending. This evidence identifies an unfinished setup transition,
not sustained idle physics motion.

The renderer now exposes `cameraReady` alongside the existing physics `atRest`
metric. Readiness requires the measured camera viewport to match the current
container, no queued resize frame, and no active SVG camera transition. The
existing resize behavior and physics definition are preserved.

The browser case verifies the edit through an independent API read and rendered
type badge. It deliberately holds real graph ResizeObserver delivery during
phone rotation and proves `atRest` can be true while `cameraReady` is false.
Readiness must remain false after observer delivery until its frame is processed.
Only then does the unchanged full 17-second motion sample begin.

On the prior runtime the new contract fails because `cameraReady` is absent;
`motion-readiness-negative.log` and its trace are retained in the owned dated
evidence directory. This local negative is a missing-contract test, not a claimed
reproduction of the original CI jump. With the correction, all three viewports
pass in 2.0 minutes, with zero retries. Build, typecheck, lint and harness 175/175
pass; existing warnings remain. Exact-head independent review and CI are required.

## Cause and corrective rule

Physics rest does not imply completion of asynchronous edits, ResizeObserver
delivery or camera framing. Observe each boundary before measuring idle behavior.
Keep the actual sample duration, per-frame observations, node count and one-pixel
limits; do not hide setup races by widening the motion threshold or retrying.

## Limits

`cameraReady` describes the current viewport, resize frame and SVG transition.
It does not promise that no future timer or user action will move the camera.
The test separately observes persistence and rendered edit completion. It uses
owned synthetic graph fixtures and strict cleanup, not production graph writes.
