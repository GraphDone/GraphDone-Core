# Spatial Stability, Physics Tuning & the Unified Test Report

> Status: findings + plan, 2026-06-13. This is a study of what already exists
> before building anything, per request. Three related asks:
> (1) node positions must survive a reload, (2) physics must be measurable and
> tuneable so we can explain drift, (3) a unified test report with screenshots
> at every resolution and web-friendly video of each mode of operation.
> Code references are to `packages/web/src/components/InteractiveGraphVisualization.tsx`
> unless noted.

---

## Ask 1 — Do node positions come back correctly after a reload?

**Short answer: no, not reliably. This is a bug, and it has a precise cause.**

What exists today:
- Positions persist to Neo4j as `positionX/Y/Z` floats (schema:
  `packages/server/src/schema/neo4j-schema.ts:324-326`); `GET_WORK_ITEMS`
  fetches them (`packages/web/src/lib/queries.ts:11-13`).
- `saveNodePosition(id, x, y)` writes them back (`:720`), called in exactly
  **one** place: the node drag-end handler (`:2250`), saving the dragged
  node's fixed position.

Why a tidy layout drifts anyway:
1. On load, each node is seeded `x = item.positionX, y = item.positionY`
   (`:1160-1161`) **but `fx`/`fy` are left null** — i.e. the saved position is
   a *starting hint*, not a *constraint*.
2. The simulation then starts hot: `.alpha(0.6).restart()` (`:3560`).
3. With that energy, every force acts on the seeded nodes — charge (`-60`),
   link springs (`0.2–0.5`), centering (`x/y 0.002`, `center 0.01`),
   collision (`0.85`), hierarchy links (`:1905-1971`) — and **pushes them off
   the saved coordinates** until the sim cools (~3s).
4. The settled-after-drift positions are **never saved** (no periodic save; the
   `visibilitychange` handler is commented out at `:3903`; there is no
   `beforeunload` save). So next reload re-seeds the *old* saved positions and
   re-drifts them again.

Net effect: a user who neatly arranges a graph sees it "relax" into a different
shape on every open. Only the last-dragged node is pinned, and **only within
that session** — on reload its `fx/fy` are null again.

Schema gap: there is no `pinned`/`fixed`/`locked` field — only the three
position floats. "This node is where I want it" is not representable.

### Options (recommendation below)

- **A. Authoritative-layout (snapshot) — recommended default.** If a graph's
  nodes already have non-default positions, load them and **do not run the
  force sim** (start at `alpha(0)`); only run physics for nodes still at
  `(0,0)` / newly created, then freeze. Closest to the literal ask: "if a user
  organizes positions, they're correct when they reopen."
- **B. Per-node pin intent.** Add a `pinned: Boolean` schema field. Pinned
  nodes load with `fx/fy` fixed and never drift; unpinned ones flow. Dragging
  pins; an explicit "let it float" / "auto-arrange" unpins. More control, needs
  a migration + UI affordance.
- **C. Debounced autosave.** Independent of A/B: persist positions after the
  sim settles and on `beforeunload`/`visibilitychange`, debounced (e.g. 1–2s
  after rest, batched `updateWorkItems`). Makes *any* arrangement — manual or
  physics-settled — durable, and makes the layout self-correcting.

**Recommendation:** A + C now (snapshot load + durable autosave) — directly
fixes the reported bug with no schema change; layer B later when we want
explicit per-node lock/unlock UX. All three are gate-testable (below).

---

## Ask 2 — Can we measure and tune the physics to explain drift?

What exists:
- `PerfMeter` (`packages/web/src/lib/perfMeter.ts`) reports fps, tick
  avg/p95/worst, dropped frames, and `alpha`, streamed to the debug console and
  `window.__graphPerf` (`:3490-3505`). Good for *frame* health.
- It does **not** measure *spatial* behavior: how far nodes move per tick, total
  displacement to settle, or displacement-from-saved-position on load — the
  numbers that actually quantify "slip and drift."

What's missing for tuning:
- The force parameters are **scattered and hardcoded** inline across
  `:1905-1975` (forces), `:3560-3562` (load alpha/decay), and the drag/resize
  restart alphas (`:2168, :2243, :3865`). There is no single source of truth
  and **no runtime tuneability** — every experiment is a recompile.

### Plan
1. **Extract `packages/web/src/lib/physicsConfig.ts`** — one typed object for
   every parameter (charge strength/distanceMax, link distance/strength,
   center/x/y strengths, collision radius-factor/strength/iterations, hierarchy
   distance/strength, alpha start/decay, velocityDecay, rest target). The
   simulation reads only from it. Pure + unit-testable.
2. **Drift instrumentation in `PerfMeter`** — add: max & mean per-tick node
   displacement, total displacement-to-settle, and on load, RMS
   displacement-from-saved-position once settled. Surface in the debug console
   and `window.__graphPerf.spatial`.
3. **Live tuning panel** (debug console tab): sliders bound to `physicsConfig`
   that call `simulation.force(...).strength(...)` and re-heat briefly, with the
   drift metrics updating live — so "why do nodes drift" becomes observable and
   answerable, not guesswork.
4. **A physics report** (see Ask 3) that runs scripted scenarios at fixed
   configs and tabulates settle-time and drift, so tuning is evidence-based and
   regressions are caught.

---

## Ask 3 — A unified test report: screenshots at all resolutions + web-friendly video of every mode

What exists:
- Playwright is configured with the **html reporter** and
  `screenshot: only-on-failure`, `trace: on-first-retry`
  (`playwright.config.ts:16-27`). **Video is not enabled.** The viewport
  matrix (Pixel 5 / iPhone 12 / 4K / Edge) is **commented out** (`:51-68`),
  so today everything runs at one desktop size.
- Two real HTML report generators exist: `tests/run-all-tests.js` (custom
  branded pass/fail report) and the Playwright html report. Neither embeds
  usage video or a screenshot gallery across resolutions.
- `responsive.spec.ts` already drives a 5-viewport matrix (iPhone SE/15, iPad,
  1080p, 4K) — the resolution list to reuse.

Don't build a custom recorder: **Playwright records `.webm` (VP8) natively** —
already the web-friendly, compressed format the ask wants. We wire it up rather
than reinvent it.

### Plan
1. **Enable native capture** for a dedicated reporting run: `video: 'on'`,
   `screenshot: 'on'`, `trace: 'retain-on-failure'`. Keep the default test runs
   light (failure-only) — capture is opt-in via a `report` project so normal CI
   stays fast.
2. **A "modes of operation" spec** (`tests/e2e/showcase.spec.ts`) that
   deliberately performs each mode end-to-end — login, create graph, grow a
   node, connect, inline-rename, edit a relationship, complete (celebration),
   undo, hover-illuminate, minimap navigate, adaptive-tier change, zoom-to-fit —
   each as a named step so each produces a labelled video + screenshots.
3. **Run it across the responsive matrix** (the 5 viewports above) so every mode
   is captured at every resolution.
4. **A unified gallery report** — a small generator that scans the Playwright
   output dir and emits one `index.html`: per mode × per resolution, the
   compressed `.webm` inline (`<video preload=metadata>`) plus key-frame
   screenshots and the drift/perf numbers from Ask 2. Web-efficient: lazy-load
   videos, posters from screenshots.
5. **`npm run report:showcase`** wires it together; artifacts upload from the
   existing CI artifact step. Optionally publish to GitHub Pages (the
   comprehensive workflow already requests `pages` permission).

---

## Build order (each slice independently shippable + behind THE GATE)

1. **Position persistence fix (Ask 1: A + C)** — highest user value; it's a
   bug. New gate assertions: arrange → reload → positions within N px;
   arrange → wait → reload (autosave) → within N px.
2. **`physicsConfig.ts` extraction + drift metrics (Ask 2 #1–2)** — no behavior
   change, pure refactor + measurement; unblocks everything else.
3. **Showcase capture + gallery report (Ask 3)** — native video, viewport
   matrix, unified report.
4. **Live tuning panel (Ask 2 #3)** — once config + metrics exist.

## Open questions for the human

- Persistence model: snapshot-authoritative (A) by default, or do you want
  explicit per-node pin/unpin (B) as the primary mental model?
- Should the showcase/video report run in CI on every PR (heavier) or only
  nightly / on demand (keeps PRs fast — recommended)?
- Drift tolerance for the gate: exact (≤2px) or "visually stable" (≤25px)?
