# Release QC ledger

Target: free Core UI, Cloudflare Pages static frontend plus supporting API/D1. Advanced managed autonomous-agent execution is deferred by product direction.

| Question group | State | Evidence / next check |
| --- | --- | --- |
| Guest dialog and narrow-screen entry (2–4, 39–41) | PASS, scoped | Five headed guest-layout cases; verification gate retained; no unnecessary overflow at 320px portrait. Hosted guest copy now comes from API configuration and explains 24-hour access and deletion. |
| Direct editing and open-dialog rotation (15–17, 38–41) | PASS, scoped | Seven headed isolated-data responsive journeys; exactly one editor opening action. Native virtual keyboard remains unverified. |
| Overview/Board opening (25–28, 36) | PASS, scoped | Headed portrait/landscape direct opening and Board keyboard journey. |
| Real recorded progress (18, 31–32, 35) | PASS, scoped | Recorded-activity unit tests, Core API-to-UI journeys, local D1 progress persistence journey. Autonomous execution and append-only attributed history are unavailable. |
| All eight workspace modes + Analytics with the same saved data (24–32, 46–48) | PASS, scoped | Three headed viewport journeys on each backend (360×640, 844×390, 1440×900); UI navigation, saved date/tag readback, totals and reload. Does not prove every control in every mode. |
| Grow, relationships, undo and failure recovery (19–22) | BLOCKED | Existing Core smoke and interaction tests need inclusion in the repeatable gate; hosted parity still needs coverage. |
| Accounts, permissions and private isolation (5–6, 34, 47, 49) | BLOCKED | Local Cloud multi-graph/cross-account CRUD passes; email/provider and full role/membership flows are not verified. |
| Accessibility beyond emulation (37–43) | BLOCKED | Keyboard dialog checks exist; native mobile keyboard, screen reader, zoom and full contrast audit incomplete. |
| Pages artifact, routing, API, cache and release operations (44–45, 50–51) | BLOCKED | Build/deploy separation, exact source integration and staged production artifact check in progress. |

A BLOCKED row prevents declaring the full app production-ready. Release a deliberately bounded preview only with a clear capability statement and retained evidence.

## New-user sweep, 2026-09-07

Evidence is local development unless explicitly stated. Core authentication uses the seeded admin; local D1 uses isolated ephemeral guests. Neither proves production account onboarding or multi-user teams. The six persona lifecycle cases passed on both backends; they exercise real UI creation, progress notes, status changes, return and totals. Shared-data modes passed on both backends. Core's 19 existing responsive/progress/admin checks and 235 web unit tests passed; follow-up changes are covered by the final gate log. The full historical MCP chaos suite is not an all-green baseline (earlier memory exhaustion).

| Questions | Result / observation |
| --- | --- |
| 1, 4, 23, 36 | BLOCKED (partial evidence): creation is now reachable from every view, defaults need only a title; no measured action-count budget across all journeys yet. |
| 2–3 | PASS scoped: guest modal/verification/layout; hosted copy describes editable temporary work. Remote expiration/provider journey unverified. |
| 5–6 | BLOCKED: dev sign-in works; account/email recovery and all unavailable-provider states need target-environment evidence. |
| 7–9, 12 | PASS scoped: selected graph data and every view reachable on portrait/landscape/desktop. |
| 10 | PASS scoped: editor/admin/guest Escape and focus checks; not every dialog audited. |
| 11 | BLOCKED (partial evidence): local route reload works; staged Pages deep links checked separately below; Back/Forward full journey pending. |
| 13–18 | PASS scoped: six UI-created lifecycle fixtures persist title, notes and status; UI deadline entry covered; D1 date/tag create/edit/clear contract passes. |
| 19–21 | BLOCKED (partial evidence): Core grow/undo smoke and D1 connection integrity checks; complete hosted UI connection/undo journey pending. |
| 22 | BLOCKED: interrupted-save/retry and conflict behavior not verified end to end. |
| 24–32 | PASS scoped: every workspace view renders the same fixture and real Analytics totals; Timeline no longer invents deadlines; Calendar retains full task text. This is not all controls/filters/date navigation. |
| 33 | BLOCKED (partial evidence): usage counts are real and layout audited; full schema/type management contract not implemented on D1. |
| 34 | BLOCKED: dialogs fit; persistence of every settings/admin action and role matrix not verified. |
| 35, 52 | PASS scoped: recorded AI contributions distinguished from execution; hosted MCP now reports unavailable rather than falsely connected. Managed autonomous agents remain deferred. |
| 37–38 | BLOCKED (partial evidence): keyboard/dialog checks and responsive journeys pass; all targets and screen-reader use not audited. |
| 39–40 | PASS scoped: guest overflow regression and mode page-width checks pass; real oversized content retains scrolling. Some complex views legitimately require scroll. |
| 41 | BLOCKED (partial evidence): open editor rotation tested; native virtual keyboard/browser zoom pending. |
| 42–43 | BLOCKED: full empty/loading/error/offline/high-contrast/reduced-motion matrix is incomplete. |
| 44–45 | BLOCKED pending staged-artifact verification; live deployment not performed. |
| 46, 48 | BLOCKED (partial evidence): D1 task lifecycle, all views, dates/tags/notes and connection API contracts pass; memberships, assignments and settings parity incomplete. |
| 47 | PASS scoped: local D1 cross-account CRUD isolation and mixed-graph rejection; full team role matrix remains blocked. |
| 49 | BLOCKED: credential expiry and reconnect recovery need a complete journey. |
| 50–51 | BLOCKED (partial evidence): separate build/publish, restricted function routes, headers and release manifest added; target secrets, remote migrations and rollback exercise not verified. |

The standard catalog and result format are `SCENARIOS.md` and `SCENARIO_RESULT_TEMPLATE.md`. Its multi-account, scale and interruption scenarios remain explicit release blockers. Single-actor fixtures set in larger teams must not be described as load tests or team collaboration coverage.

### Evidence files for this sweep

- `/tmp/graphdone-core-quality-final.log`: 33 passed before the subsequent graph-motion, details and resize changes; this is not a final rerun of the expanded gate.
- `/tmp/graphdone-cloud-quality-final.log`: 8 passed, 1 startup/loading timeout; `/tmp/graphdone-cloud-large-final.log`: isolated retry passed. Keep both results; do not erase the initial failure.
- `/tmp/graphdone-core-modes.log`: 3 passed; `/tmp/graphdone-core-personas.log`: 6 passed.
- `/tmp/graphdone-qc-unit-final.log`: 235 web tests passed.
- `/tmp/graphdone-qc-build-final.log`: web build passed; bundle-size warning remains.
- `/tmp/graphdone-qc-lint-final.log`: zero errors, 702 warnings (not a warning-free baseline).
- `test-artifacts/quality/`: persisted screenshots labelled by backend, viewport/mode or scenario ID. Screenshots are evidence, not substitutes for assertions.

Cloud API local contract scripts cover separate owned graphs, mixed-graph rejection, foreign reads/writes, edge cascade integrity, and date/tag create/edit/clear. No remote migrations, emails or production writes were performed during this sweep.

### Graph motion investigation

The strengthened desktop drag test failed before the change because the simulation kept running after a verified saved drag. The first fix passed phone portrait and landscape but found a 545px desktop jump while idle after a type edit. Rebuilt SVG node groups had no position until the next physics tick. Nodes now receive their saved translation immediately; retired simulations stop and lose callbacks; pinned graphs do not reheat on release/resize; configured damping is preserved. Raw motion samples are written to `test-artifacts/quality/motion-<width>.json`. Final rerun results are recorded below.

Hands-on local browser pass: created the private `Graph-first hands-on QC` graph through the graph selector, created a task through the form, dragged it with pointer down/move/up, then used the node's + control and canvas click to grow and name a second connected task. Screenshots: `hands-on-created.png`, `hands-on-dragged.png`, `hands-on-grow-mode.png`, `hands-on-connected.png`. This graph is retained for continued UI inspection; no unrelated graph was edited.

Graph-details follow-up: `/tmp/graphdone-core-details.log`: 3 headed tests passed at phone portrait, landscape and desktop. These verify status display, retaining unsaved date/tag edits across polling, saving them, clearing the date, and remaining in Graph view.

Resize regression: `/tmp/graphdone-resize-before.log` reproduced a 60px centering error during incremental desktop growth. The camera observer now handles every actual nonzero size change, coalesced per animation frame, with no overlapping zoom transitions. It does not modify saved node coordinates. `/tmp/graphdone-resize-motion-after.log`: all 4 headed tests passed, including the incremental grow/shrink/rotation regression and three drag/edit stability cases. The resize case also verified identical persisted node coordinates. `/tmp/graphdone-web-graph-unit.log`: 235 web tests passed; `/tmp/graphdone-web-resize-build.log`: build passed with the existing chunk-size warning.

### Expanded review (2026-09-07)

- `/tmp/graphdone-qc-expanded.log`: 40 headed Core checks passed before the subsequent stacked-layout, Turnstile and visual changes.
- Local D1 security checks reproduced a named-fragment depth-limit bypass. The validator now expands fragments, rejects cycles and caps expanded selections; `/tmp/graphdone-security-after.log` passes 7 checks, including eight concurrent batches at the 300-node boundary (one accepted, seven rejected). This local result does not prove distributed quota atomicity.
- `test-turnstile.mjs` passes rejection/action/hostname/outage verification cases. Production keys are not configured.
- Dependency audit (`npm audit --omit=dev`, `/tmp/graphdone-dependency-audit.json`) reports 57 advisories: 4 critical, 25 high, 25 moderate, 3 low. These are dependency findings, not evidence of exploitation; remediation remains required.
- `/tmp/graphdone-layout-before.log`: stacked saved cards failed the new geometric gate before repair. `/tmp/graphdone-layout-controls-after.log`: 5 passed: all quick-editor types/statuses on phone and desktop, and card separation at 12/50/200 nodes across reload. This is not proof of label/edge clearance or a maximum supported graph size.
- `/tmp/graphdone-studio-unit.log`: 237 web tests passed. `/tmp/graphdone-studio-build.log`: build passed with the existing bundle-size warning.

Final checks for this iteration:

- `/tmp/graphdone-button-content-final.log`: 728 visible button instances inspected across seven routes and seven viewport sizes, including project menus; zero content-overflow failures. The project name now has at least 100px usable space. This is not coverage of every hidden submenu or action.
- `/tmp/graphdone-button-turnstile.log`: both official-test-key Turnstile guest journeys passed (390×844 and 844×390); its separate button scan failed on nested main landmarks, which was fixed and rerun above. No real production widget was configured.
- `/tmp/graphdone-visual-verification.log`: nine guest-layout, drag-stability and resize checks passed; initial two Turnstile assertions failed and were corrected in the later run (config test fixture and phone selector).
- `/tmp/graphdone-ui-final-build.log`: build passed; `/tmp/graphdone-ui-lint.log`: zero errors, 713 warnings.
- Visual direction: charcoal surfaces, static fine texture on sign-in, solid wordmark, editorial heading, quieter card headers, small completion marks and full-label zoom fading. Screenshots in `test-artifacts/quality/studio-*.png`. This is a first visual pass, not a complete redesign of every screen.

`/tmp/graphdone-iteration-final-unit.log`: 237 web tests passed after the visual and selector changes. Final whitespace validation passes. The first sign-in screenshots still show the legacy math challenge on Core email login; this iteration integrates Turnstile for hosted guest entry only. Account/email verification migration remains open.

## Human–agent connection iteration, 2026-09-07

- Core server typecheck and web production build pass. Web unit suite: 237 passed. Existing bundle-size warning remains.
- `graphdone-agent-review.log`: 7 passed (three human–agent journeys, three modal/header/Escape journeys, 742 button instances with zero content failures); three visual cases failed because their expected headline was stale.
- `graphdone-agent-final-headed.log`: all 6 passed after updating the headline assertion and making the agent panel header sticky (three agent journeys and three visual cases). This also covers the Core active-token limit implementation on ordinary issuance, not a 25-token concurrency stress test.
- `graphdone-cloud-agent-headed.log`: all 3 hosted UI cases passed against local D1, plus the D1 token/notes/progress/security contract. Local migration 0007 applied. This is not a production deployment.
- New repeatable commands: `qc:agents`, `qc:modals`; new OpenAPI document and connection guide in `docs/agents/`. Cloud headed contract invocation: `DISPLAY=:1 PLAYWRIGHT_BROWSERS_PATH=/tmp/graphdone-playwright QC_AGENT_HEADED=1 node scripts/test-agent-connections.mjs`.
- Remaining: provider/MCP adapters, task creation/deletion through agent API, shared-team issuance permissions, distributed quota/retention stress, and previously recorded dependency/security/release blockers. Core note/token cleanup following deleted projects still needs lifecycle integration; D1 uses cascading foreign keys.

### Main-site recovery requested

Public checks at 2026-09-08 04:11–04:13 UTC: `graphdone.com` and `www.graphdone.com` return Cloudflare 522; `graphdone-cloud.pages.dev` returns 200; production API health returns healthy. Main-domain API preflight lacks Access-Control-Allow-Origin, so custom-domain recovery must include API origin configuration. Cloudflare CLI authentication is expired (OAuth refresh 400). Reauthentication opened in the headed browser; no remote mutation performed while awaiting access.
