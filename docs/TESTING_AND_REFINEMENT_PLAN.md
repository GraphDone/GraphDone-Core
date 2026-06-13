# Testing & Refinement Plan — Living Graph Era, Cycle 2

> The rule from the reboot: **we are never "done" — finishing a slice creates the next plan.**
> Cycle 1 (June 2026) shipped the adaptive quality engine, the first living-graph
> effects, `get_graph_context`, the responsive viewport matrix, and the
> story-driven backlog. This document is the plan it created.

## A. Verification debt from Cycle 1 (do first)

| Item | What to do | Exit criteria |
|------|-----------|---------------|
| **CI now runs the real suites** ✅ | Fixed 2026-06-13: ci.yml was disabling every Vitest suite behind a phantom "Rollup issue" and the comprehensive workflow fabricated results. Now the real core/web/server/mcp suites, the build, and THE GATE (full-stack smoke) all run and gate on every push/PR. Root cause was the `npm ci` optional-deps bug — fixed with `npm install`. | done — green on PR #37 |
| **PR-critical E2E burn-down** | The focused **smoke gate** (`test:smoke`, 3 checks) is the canonical blocking E2E and is green. The broader `test:pr` suite (~64 checks) runs as **advisory** in CI and still has known failures; migrate its specs to the `tests/helpers/api.ts` authenticated pattern (5 already done) until it can gate. | `test:pr` green, then promote to blocking |
| ~~Chaos suite: assertion failures~~ | ✅ Fixed 2026-06-10. Full suite 4,736 pass / 1 skipped / 0 assertion failures. | done |
| Chaos worker-crash on local full run | Running the mcp chaos suites locally (CI skips them via `describe.skipIf(process.env.CI)`) ends with one tinypool "Worker exited unexpectedly" from `multi-perspective-chaos.test.ts` — a resource-exhaustion worker crashing, not an assertion failure (exit 1 only locally). Harden the scenario to not crash the worker, or cap its concurrency. | local `npm run test -w @graphdone/mcp-server` exits 0 |
| Quality tiers on real devices | The governor is unit-tested; it has never been observed on a real phone. Throttle CPU 6x + 3G in devtools, confirm tier drops and effects strip. | Manual checklist + screen recording in PR |
| Entrance animation under data churn | LIVE-8 runs on first init only; verify polling/subscription updates never re-trigger it or leave nodes at opacity 0. | E2E: graph open → wait 30s with live updates → all nodes opacity 1 |
| `get_graph_context` against real Neo4j | Tool is mock-tested. Run against seeded dev DB; verify the Cypher (`CALL` subquery syntax) on Neo4j 5.26 and the <2kB budget with 500-node graphs. | Integration test in mcp-server using live driver, CI-gated behind env flag |
| Visual regression baseline | We changed node rendering. Re-baseline the visual regression suite, review diffs intentionally. | `npm run test:e2e:visual` green with reviewed baselines |

## B. Performance test harness (ADAPT-8 — the scaling contract)

Build `tests/perf/` so performance claims are tested, not vibes:

1. **Reference graphs as fixtures** — generators for 100 / 500 / 2,000 / 10,000-node graphs with realistic edge density (committed seeds, deterministic).
2. **Render benchmarks** (Playwright + CDP): time-to-first-paint of graph view, dropped-frame % during a scripted 10s pan/zoom, per quality tier.
3. **Budgets enforced in CI** (fail, don't warn):
   - Web bundle ≤ 450 kB gzip (currently ~375 kB — headroom is intentional)
   - 500-node first render < 1.5 s on a 4×-CPU-throttled runner
   - Dropped frames < 20% during pan at MEDIUM tier
   - `get_graph_context` p95 < 150 ms on the 2,000-node fixture
4. **Network profiles**: re-run the core E2E flow under Playwright's `slow-3g` emulation; assert progressive loading kicks in (ADAPT-4) and TTFP < 2 s.

## C. Refinement targets (user-visible polish)

Ordered by joy-per-effort:

1. **LIVE-3 celebration burst** — completing a task must feel good. Particle ripple ≤1.2s, tier-gated, reduced-motion-safe.
2. **LIVE-7 neighborhood illumination on hover** — 1-hop highlight, <16ms on 500 nodes (pre-compute adjacency map, no DOM walking).
3. **LIVE-2 energy flow on edges** — animated dashes from completed → dependent work. CSS `stroke-dashoffset` animation, zero JS per frame.
4. **ADAPT-6 settings UI** — quality override dropdown (Auto/Low/Medium/High/Ultra) in Settings; the engine already supports it (`setOverride`), this is pure UI.
5. **ADAPT-4 progressive graph streaming** — server-side: bounded initial query (my items + highest priority first), background frontier fetch. This is the big scalability unlock; design doc before code.
6. **RESP-1/2 phone interactions** — bottom-sheet editor, pinch/long-press. Build on the now-green viewport matrix.

## D. Process refinements

- **Story discipline**: every PR title carries a story ID; stories flip status in the same PR that ships them. No orphan code.
- **Flake policy**: a test that fails twice without a code cause gets quarantined *with a linked issue* within 24h — never deleted, never ignored silently.
- **Device lab cadence**: once per cycle, run the app on a real phone over cellular and file what felt slow as ADAPT stories. Synthetic throttling lies.
- **AI parity check** (AI-1): per cycle, list any UI capability an MCP agent can't perform; each gap becomes a story.

## E. Definition of "cycle complete"

A cycle ends when: (1) section A is empty, (2) at least two section-C stories shipped test-first, (3) CI is green three consecutive runs on develop, and (4) **the next version of this plan exists**.
