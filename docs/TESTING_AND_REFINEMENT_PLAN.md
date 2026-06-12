# Testing & Refinement Plan — Living Graph Era, Cycle 2

> The rule from the reboot: **we are never "done" — finishing a slice creates the next plan.**
> Cycle 1 (June 2026) shipped the adaptive quality engine, the first living-graph
> effects, `get_graph_context`, the responsive viewport matrix, and the
> story-driven backlog. This document is the plan it created.

## A. Verification debt from Cycle 1 (do first)

| Item | What to do | Exit criteria |
|------|-----------|---------------|
| **17 failing PR-critical E2E tests** | The CI gate is honest again (docker compose v2 + build window + health-port fixes) and ran its Playwright suite for the first time in months: 10/33 pass. All 17 failures die in ~2s against the prod HTTPS stack — find the common root cause (likely auth/navigation against `https://localhost:3128`), then burn down the rest. This is the pre-existing debt CLAUDE.md flagged in 2025-09. | `PR Critical Tests` check green on develop |
| ~~Chaos suite: last failure~~ | ✅ Fixed 2026-06-10: two test bugs (swallowed AssertionErrors; CPU-protection rejections not in the allowed-error regex). Full suite 4,736 pass / 0 fail. | done |
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
