---
name: run-journeys
description: Use when you need to know how reliably people can do a basic task in GraphDone (connect two items, and later create, edit, delete, move, undo) on desktop, iPad and iPhone, before or after a fix or a release, or when adding a new journey path. Produces a success rate and 95% lower bound per path and device.
---

# Measure basic journeys

The journey suite (`tests/e2e/journeys/`, helpers in `tests/lib/journeys/`)
repeats each way of doing a basic task in a fresh browser and reports a success
rate per path and device in the unified report. A red cell is a product bug to
fix, not a baseline to accept. Folder details:
[`tests/e2e/journeys/README.md`](../../../tests/e2e/journeys/README.md).

## Run it

```bash
# Browsers: keep them in a directory you own; the default cache can be wiped.
export PLAYWRIGHT_BROWSERS_PATH=<your scratch dir>/browsers
npx playwright install chromium

# Against a disposable local stack (signs in as the admin test user):
TEST_URL=http://localhost:3127 node tests/run-unified.mjs --profile journeys

# Against the hosted build as a guest (work stays in the throwaway browser,
# so nothing is left on the server):
TEST_URL=https://graphdone.com JOURNEY_BACKEND=hosted-guest \
  node tests/run-unified.mjs --profile journeys
```

- `JOURNEY_REPEAT` sets trials per path and device (default 10). 10/10 proves
  at least ~72% with 95% confidence; about 300 clean runs are needed to show
  under 1% failure. Use 30 or more before claiming a release is reliable.
- Projects: `journeys` (desktop), `journeys-ipad`, `journeys-iphone` (Chromium
  touch emulation; WebKit cannot pinch).
- To rerun one cell: `npx playwright test tests/e2e/journeys/link.spec.ts
  --project=journeys-iphone --grep "<path name>" --repeat-each=10`.

## Read the result

`test-artifacts/unified/report.html` (and `report.json`) shows, per path and
device, passes/trials and the Wilson 95% lower bound. Failures whose message
starts with `SETUP:` happened before the path's own action and are counted
apart; fix the harness for those. Every other failure: open its trace and
screenshot, find the product cause, fix it, and rerun the same cell to the same
count. Report before/after numbers in the PR.

## Before a hosted release

Build the hosted web bundle from your Core checkout and serve it locally, then
run the suite with `TEST_URL` pointing at it, so a regression is caught before
it reaches graphdone.com. The hosted build's own repository documents the build
command.

## Add a path or a journey

1. Add the path to `tests/lib/journeys/linkPaths.ts` (or a new
   `tests/lib/journeys/<journey>Paths.ts`) using real user controls only: no
   forced clicks, no retries that hide a failure.
2. Assert what the user sees (drawn, header counts), what was saved, and that it
   survives a reload, as `link.spec.ts` does.
3. Run it on all three projects with `JOURNEY_REPEAT=10` and record the table in
   the PR and the tracking issue.
