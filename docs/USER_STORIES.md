# GraphDone User Stories — The Backlog That Drives Development

> Every feature starts here. Every story maps to tests. If a story has no test, it isn't done — it isn't even started.
>
> **Status legend**: 💤 backlog · 🔨 in progress · ✅ shipped (tests green) · 🧪 shipped, needs test hardening

This backlog is organized by epic. Each story has acceptance criteria (AC) and a **test mapping** — the concrete test file(s) that prove it works. Test-driven development means the test file is written *first*, red, then made green.

Why this exists: everybody hates Jira. GraphDone wins by being **alive, fast everywhere, and equally usable by humans and AI agents**. These stories are the contract for that.

---

## Epic 1: The Living Graph 🌊
*The graph should feel like a living organism, not a diagram. Work that's active glows. Completed work celebrates. Blocked work visibly aches.*

| ID | Story | AC | Test mapping | Status |
|----|-------|----|--------------| ------|
| LIVE-1 | As a user, I want active (in-progress) nodes to breathe with a gentle glow pulse, so the graph shows me where life is at a glance. | Nodes with status IN_PROGRESS pulse (scale/glow oscillation ≤ 2s period); animation pauses on `prefers-reduced-motion`; zero pulse when quality tier is LOW. | `web/src/lib/__tests__/nodeAnimations.test.ts`, e2e visual `tests/e2e/living-graph.spec.ts` | ✅ |
| LIVE-2 | As a user, I want energy to visibly flow along dependency edges toward unblocked work, so I can *see* momentum. | Animated directional particles/dashes on edges from completed → dependent nodes; flow speed reflects recency of upstream completion; disabled at LOW tier. | `nodeAnimations.test.ts`, `living-graph.spec.ts` | ✅ |
| LIVE-3 | As a user, when I complete a task I want a brief, satisfying celebration (burst/ripple from the node), so finishing feels rewarding. | Completion triggers ≤ 1.2s particle burst; never blocks input; respects reduced-motion; at most one celebration concurrently per node. | `living-graph.spec.ts` | 💤 |
| LIVE-4 | As a user, I want blocked nodes to look visibly "stuck" (desaturated, slow dim pulse), so blockers jump out without reading labels. | BLOCKED status renders desaturated fill + distinct ring; discernible in colorblind sim (shape/ring cue, not color alone). | `nodeAnimations.test.ts`, a11y check in `living-graph.spec.ts` | ✅ |
| LIVE-5 | As a user, I want node glow intensity to reflect priority, so the important stuff literally shines brighter. | Glow radius/opacity scales with computed priority across 4 visually distinct steps; recalculates when priority changes without full re-render. | `nodeAnimations.test.ts` | ✅ |
| LIVE-6 | As a user, I want smooth force-simulation motion that settles quickly, so the graph feels organic but never seasick. | Simulation alpha decays to rest < 3s after drag release on a 200-node graph at MEDIUM tier; no oscillation at rest. | perf test `tests/perf/simulation.bench.ts` | 💤 |
| LIVE-7 | As a user, I want hovering a node to softly illuminate its neighborhood (1-hop), so I can trace connections without clicking. | Hover highlights node + 1-hop edges/nodes in < 16ms on 500-node graph; non-neighbors dim; exits cleanly. | `living-graph.spec.ts`, `simulation.bench.ts` | 💤 |
| LIVE-8 | As a returning user, I want the graph to greet me with a brief "wake up" animation (nodes fading/floating in by recency), so opening GraphDone feels like arriving somewhere alive. | Initial render staggers node entrance ≤ 800ms total; skipped at LOW tier and reduced-motion; never delays interactivity. | `living-graph.spec.ts` | ✅ |

## Epic 2: Adaptive Performance 📶
*GraphDone runs beautifully on a workstation and gracefully on a phone on cellular. Quality scales with available compute and bandwidth — automatically, transparently, and testably.*

| ID | Story | AC | Test mapping | Status |
|----|-------|----|--------------|------|
| ADAPT-1 | As a user on any device, I want the app to pick a quality tier (LOW/MEDIUM/HIGH/ULTRA) from my device + network, so I never configure performance myself. | Tier computed from `navigator.connection` (effectiveType, saveData), `deviceMemory`, `hardwareConcurrency`; deterministic mapping covered by unit tests for all input combos. | `web/src/lib/__tests__/adaptiveQuality.test.ts` | ✅ |
| ADAPT-2 | As a user on cellular or with Save-Data, I want reduced data usage (smaller attachment previews, no auto-media), so GraphDone respects my plan. | saveData or cellular ⇒ tier ≤ MEDIUM, preview size ≤ 256px request param, no preview autoload at LOW. | `adaptiveQuality.test.ts` | ✅ |
| ADAPT-3 | As a user on a weak GPU/CPU, I want effects to degrade before interactivity does (glow → simple circles, animations off), so the graph stays responsive. | FPS governor: sustained < 30fps for 3s ⇒ step tier down; < 15fps ⇒ LOW; effects map per tier documented and unit-tested. | `adaptiveQuality.test.ts`, `simulation.bench.ts` | ✅ |
| ADAPT-4 | As a user with a huge graph on a slow link, I want the graph streamed by relevance (my items + center-of-gravity first, periphery progressively), so first paint is fast. | Initial query bounded (≤ 150 nodes); progressive fetch fills periphery in background; loading affordance on unexpanded frontier; TTFP < 2s on simulated 3G for 1k-node graph. | server test `server/src/__tests__/progressive-loading.test.ts`, e2e `tests/e2e/adaptive.spec.ts` | 💤 |
| ADAPT-5 | As a user who upgrades conditions (wifi, plugged in), I want quality to step back up automatically, so I get the pretty version when I can afford it. | `connection.change` listener re-evaluates tier; hysteresis prevents flapping (≥ 10s between step-ups); unit-tested state machine. | `adaptiveQuality.test.ts` | ✅ |
| ADAPT-6 | As a user, I want to optionally pin a quality tier in Settings (Auto / Low / High...), so I stay in control when auto guesses wrong. | Settings override persists (localStorage); "Auto" returns to detection; UI shows current effective tier. | `adaptiveQuality.test.ts`, `adaptive.spec.ts` | ✅ |
| ADAPT-7 | As a phone user, I want LOD (level-of-detail) tuned per tier — labels, icons, minimap appear/disappear by zoom *and* tier — so small screens stay readable and fast. | LOD thresholds parameterized by tier; snapshot tests per tier; no text rendering at far zoom on LOW. | `adaptiveQuality.test.ts` | 💤 |
| ADAPT-8 | As a developer, I want performance budgets enforced in CI (bundle size, TTI, fps on reference graph), so regressions get caught before merge. | CI job fails if: web bundle gzip > 450kB, 500-node graph first-render > 1.5s in headless bench, dropped-frame rate > 20% in pan bench. | `tests/perf/*.bench.ts`, CI workflow | 💤 |
| ADAPT-9 | As a user with `prefers-reduced-motion`, I want all animation suppressed regardless of tier, so accessibility beats aesthetics. | Reduced-motion forces animation-free rendering at any tier; verified in unit + e2e. | `adaptiveQuality.test.ts`, `living-graph.spec.ts` | ✅ |

## Epic 3: Responsive Everywhere 📱💻
*Phone, tablet, PC — same living graph, appropriately shaped.*

| ID | Story | AC | Test mapping | Status |
|----|-------|----|--------------|--------|
| RESP-1 | As a phone user, I want a bottom-sheet node editor instead of side panels, so I can edit one-handed. | < 640px: editors render as bottom sheets with drag handle; no horizontal scroll anywhere. | `tests/e2e/responsive.spec.ts` (viewport matrix) | 💤 |
| RESP-2 | As a phone user, I want touch gestures — pinch zoom, two-finger pan, long-press for node menu — so the graph is fully usable by touch. | Pinch/pan/long-press verified via Playwright touch emulation; no accidental node drags while panning. | `responsive.spec.ts` | 💤 |
| RESP-3 | As a tablet user, I want a collapsible sidebar and 44px+ touch targets, so the UI works for fingers. | All interactive elements ≥ 44×44 px effective hit area at < 1024px; sidebar auto-collapses. | `responsive.spec.ts` | 💤 |
| RESP-4 | As a PC user, I want keyboard-first flows (command palette, arrow-key graph nav), so power use is fast. | `Cmd/Ctrl+K` palette: create node, jump to node, change status; arrow keys traverse graph along edges. | `tests/e2e/keyboard.spec.ts` | 💤 |
| RESP-5 | As any user, I want the viewport tested on iPhone SE, iPhone 15, iPad, 1080p, 4K in CI, so responsive never regresses. | Playwright project matrix covers 5 viewports for core flows (open graph, create node, edit, complete). | `responsive.spec.ts` | ✅ |

## Epic 4: AI-First Platform 🤖
*An AI agent is a first-class teammate. Anything a human can do in the UI, an agent can do through MCP/GraphQL — with the same vocabulary.*

| ID | Story | AC | Test mapping | Status |
|----|-------|----|--------------|--------|
| AI-1 | As an AI agent, I want every UI capability available via MCP tools with consistent naming, so I never hit "UI-only" walls. | Capability parity checklist documented; gaps tracked; MCP tool names match domain vocabulary (work item, edge, graph). | `mcp-server/tests/capability-parity.test.ts` | 💤 |
| AI-2 | As an AI agent, I want machine-readable errors (code + hint + retryable flag), so I can self-correct without human help. | All MCP tool errors return `{code, message, hint, retryable}`; unit tests cover each error path. | `mcp-server/tests/error-contract.test.ts` | 💤 |
| AI-3 | As a developer integrating an agent, I want a single doc page with copy-paste MCP setup for Claude Code/Desktop, so setup takes < 5 minutes. | `docs/api/AI_AGENTS.md` quickstart verified by fresh-clone walkthrough; includes auth, example session. | doc + smoke script | 💤 |
| AI-4 | As an AI agent, I want bulk operations (create N items + edges atomically), so building a project plan is one call, not fifty. | `bulk_operations` accepts mixed create/update/connect; atomic per batch; partial-failure report. | existing + `mcp-server/tests/bulk.test.ts` | 🧪 |
| AI-5 | As a human, I want agent actions visibly attributed in the graph (agent avatar/badge), so I always know who/what did what. | Items track creator type (human/agent); UI badge on agent-touched nodes; filterable. | `server` resolver test + e2e | 💤 |
| AI-6 | As an AI agent, I want a `get_graph_context` tool that returns a compact, token-efficient summary of a graph (stats, hot nodes, blockers), so I can orient in one call. | Returns < 2kB summary for any graph: counts by type/status, top blockers, recent activity. | `mcp-server/tests/context.test.ts` | ✅ |

## Epic 5: Flow & Joy ✨
*Friction is the enemy. Capture an idea in two keystrokes; organize it visually later.*

| ID | Story | AC | Test mapping | Status |
|----|-------|----|--------------|--------|
| FLOW-1 | As a user, I want quick-capture (`n` key or `+` FAB) that creates a node where I'm looking, so ideas land before they evaporate. | From graph view: keypress → inline title input at cursor/viewport center → Enter persists; ≤ 2 interactions total. | `keyboard.spec.ts` | 💤 |
| FLOW-2 | As a user, I want drag-to-connect with magnetic snap and live edge preview, so wiring dependencies feels tactile. | Drag from node edge ring → elastic preview edge → snap radius highlights target → release creates typed edge. | `tests/e2e/edges.spec.ts` | 🧪 |
| FLOW-3 | As a user, I want undo/redo for graph mutations (create/move/connect/delete), so experimentation is safe. | Cmd/Ctrl+Z / Shift+Z; ≥ 20-step history; server-confirmed ops reconcile correctly. | `web/src/lib/__tests__/undoStack.test.ts` | 💤 |
| FLOW-4 | As a user, I want the app to feel instant (optimistic updates everywhere), so I never wait for the server to see my change. | All mutations render optimistically < 50ms; rollback UX on failure with toast. | e2e latency assertions | 💤 |

## Epic 6: Together 👥
*Presence makes a tool feel inhabited.*

| ID | Story | AC | Test mapping | Status |
|----|-------|----|--------------|--------|
| TOG-1 | As a team member, I want to see live cursors/avatars of others viewing the same graph, so the space feels shared. | Presence via existing WS; cursors fade after 30s idle; ≤ 1 update/100ms throttle. | `tests/e2e/presence.spec.ts` | 💤 |
| TOG-2 | As a team member, I want node changes by others to animate in live (not require refresh), so the graph is a shared living document. | Subscription-driven updates animate (new node fades in, status change pulses); no full refetch. | `presence.spec.ts` | 💤 |

---

## How stories drive development (the loop)

1. **Pick** the highest-leverage 💤 story (lead dev or contributor).
2. **Write the test first** — unit test for logic, Playwright for UX, bench for performance. It must fail.
3. **Implement** until green. Effects/visuals also get a quality-tier mapping (see ADAPT-3).
4. **Update this file** — flip status, link the test.
5. **PR to `develop`** referencing the story ID in the title (e.g., `LIVE-1: breathing glow for active nodes`).

## Reference hardware/network profiles (for perf stories)

| Profile | Device | Network | Expected tier |
|---------|--------|---------|---------------|
| `workstation` | 8+ cores, 16GB+, discrete GPU | wifi/ethernet | ULTRA |
| `laptop` | 4–8 cores, 8GB | wifi | HIGH |
| `tablet` | 4 cores, 4GB | wifi | MEDIUM |
| `phone-good` | 4 cores, 4GB | 4g | MEDIUM |
| `phone-constrained` | 2 cores, 2GB | 3g or saveData | LOW |

These profiles are encoded in `packages/web/src/lib/adaptiveQuality.ts` and exercised by its unit tests — change them there and here together.
