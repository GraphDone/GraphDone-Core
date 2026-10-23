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

### 2026-09-08 live signup incident and expanded agent gate

The signup hotfix is live separately from the graph UI work. See GraphDone-Cloud `docs/PAGES_RELEASE.md` for release details. Production was tested using the owner's delivered code through the actual form, then UI project/task creation and reload at 390×844, 844×390 and 1440×900; zero browser console errors. An isolated local D1 lifecycle test caught and fixed email-prefix username collisions in new-account creation. Existing-account login is not counted as new-account inbox verification.

Real-inference gate: `QC_REAL_AGENTS=1 TEST_URL=http://localhost:3127 npm run qc:real-agents` (added alongside this entry) uses disposable local Core projects, reads the actual copied UI prompt, and runs installed Claude/Codex CLIs in scratch directories. Default models: Claude Haiku and GPT-5.4-mini, overridable with `QC_CLAUDE_MODEL` / `QC_CODEX_MODEL`. Each run has a 180-second process cap; Claude additionally has a $0.25 CLI cap. Codex has no dollar-budget cap in this harness: do not expand it into thousands of runs without gateway-enforced spending limits. Credentials are revoked in cleanup; redacted transcripts go to ignored `test-artifacts/quality/real-agent-*.json`. Only the one student handoff is covered so far; model-generated work quality still needs human review and additional persona/adversarial scenarios.

The first Claude Haiku handoff completed and was visible in the UI. An early revocation check raced the UI request; the regression now waits for completed revocation. Codex GPT-5.4-mini also passed the saved-state/UI/revocation assertions through the test-only local MCP adapter. Its shell attempt failed because this host cannot create the bwrap UID map. The adapter exposes only context/update/note operations on localhost:3127, caps calls at 20, and preauthorizes only these three explicitly requested fixture operations for the CLI invocation; user/global Codex configuration is not modified. Gateway credentials have not yet been located. No remote D1 is used by these inference cases.

Hosted fair-share admission has a separate prototype in `/tmp/graphdone-usage` (`improve/fair-usage`). Its 10,000 allocation-policy attempts are not end-to-end UI tests or model runs, and production enforcement/UI remain pending. Do not claim complete coverage or per-user daily protection from this policy result.

Reported-controls follow-up: all 3 headed cases passed at 844×390, 1440×900 and 2560×1440 after the empty-alert helper fix. They exercise account-menu visibility/hit-testing/Escape focus, disabled template messaging, hierarchical card separation, and three settled minimap reopen cycles. Compact-layout unit suite: 18 passed, including mixed card sizes and 200 independent tasks without card overlap. Web typecheck passed. This does not establish edge-label clearance or readability of every title in a 200-node overview.

## Hosted allowance follow-through — 2026-09-08

Cloud `docs/FAIR_USAGE.md` is the enforcement contract. Core's hosted build shows
actual account operations/row counters and local reset times, with 80/95/100%
warning states. Self-hosted Core has no hosted limits or usage UI by default.

Repeatable headed scenario: `tests/e2e/quality/hosted-usage.spec.ts`, with
`VITE_HOSTED_USAGE=true` on local Vite. Six viewports (320 portrait through 2560
landscape), personal/shared pauses, simulated reset, rejected task creation,
retained text, blocked reload, retained login, hit-tested recovery download.
All six passed. The test uses local Core and intercepted quota responses;
Cloud's complementary `test-hosted-usage.mjs` exercises actual local D1/DO,
including signup, agent owner accounting, concurrency, failure and UTC reset.

The harsher blocked-reload test exposed a real empty-workspace overflow that
covered the recovery button. The empty panel now scrolls within its own bounds.
Quota errors no longer clear cached authentication or auto-create welcome graphs.
Reported controls regression (three headed sizes) passed: user-menu placement,
nonfunctional template labeling, minimap reopen and compact hierarchy.

Recovery records are per-tab, per-account sessionStorage (last 20 distinct
unconfirmed graph/task operations). They can be downloaded after reload but are
not an offline database or automatic retry queue. Check for partial server
success before reapplying. Full offline guests/sync, comprehensive security
clearance and all-persona inference sweeps remain separate work.

## Offline storage and sync — September 8, 2026

The managed client now has an account-scoped IndexedDB project store, local-first task/position/edge/project mutations, human note persistence, an exact-request upload queue, three-way conflict review, backup export/import, local-only guest onboarding, and a precached production app shell. Enable with `VITE_OFFLINE_SYNC=true` only against the compatible managed `/api/sync` backend. Standalone Neo4j remains unchanged by default.

Repeatable sequence: start Cloud `scripts/test-offline-sync.mjs --serve`, build Core with the local API at `http://localhost:8798` and both `VITE_OFFLINE_SYNC=true` / `VITE_HOSTED_USAGE=true`, preview on 3136, then run `DISPLAY=:1 PLAYWRIGHT_BROWSERS_PATH=/tmp/graphdone-playwright TEST_URL=http://localhost:3136 npm run qc:offline`. Restart the isolated fixture server between full sweeps to reset its quota ledger. Run headed tests serially without source/build changes during a run.

Latest result: **3 headed scenarios passed (50.9 seconds)**. Student team: six viewport bounds, real offline task creation and mouse drag, table/card/Kanban/Gantt/calendar/activity/graph navigation offline, offline reload, persisted quota deadline with no retry loop, reconnect and exact-once remote creation, second tab, real local agent token, offline human note, competing agent priority update, explicit conflict resolution, credential-free export and imported project with new IDs. Guest: no cloud mutation during onboarding and offline reload. Parent: school pickup task survives closing the entire browser and reopening its profile offline.

Nine unit cases passed, including 1000 deterministic disjoint human/agent edit scenarios, delete/edit conflicts, edits made during an in-flight upload, bounded dependency-ordered batches, and malformed backup rejection. Cloud's real local D1 tests cover replay, owner isolation, atomic revision races, agent writes, 2000 full-length notes (8 MB), metering regressions, and signup regressions. This does not claim exhaustive browser/device/security coverage or thousands of inference calls.

Downloaded projects work offline; unopened projects need an initial download (Settings can prepare all). Uploads resume while the app is open and cloud access is available. Browser data clearing can remove local copies; export important work. Account records are currently rewritten as one transaction, so very large accounts still need low-memory-device benchmarking. Agent credentials and account administration remain online-only. The hosted backend's existing sharing and unsupported-property limitations remain.

Live acceptance found the legacy red connection overlay could cover the inspector after an offline reload. Offline-enabled workspaces now use the in-flow storage status instead; connection and usage indicators refresh on reconnect. The local gate now deliberately aborts health probes and still clicks Edit. Agent-token controls are disabled offline while notes remain usable. Local resource caps reject an over-limit edit before acknowledgement, and the initial hosted account project cannot be deleted locally. A tenth unit case covers deletion while a create acknowledgement is in flight, ignoring server timestamps when detecting real conflicts. Latest expanded headed result: **3 passed in 52.4 seconds**.

Quota recovery additionally retains the account profile in IndexedDB. A returning token can recover the cached profile without a D1 `Me` query, while uploads still require server authorization. Profile caches are excluded from project exports. The final local sweep explicitly removes the browser's currentUser cache, reloads during a persisted quota pause, asserts zero network `Me` requests, and recovers both tasks: **3 headed scenarios passed in 48.9 seconds**.

A persisted upload attempt counter now prevents silent resurrection after receipt retention: a retried creation missing from the cloud requires review after a revision conflict. This covers a lost acknowledgement followed by another device deleting that item, even after the server's bounded receipt history expires. Eleven unit cases passed; the full headed sequence passed again in **48.6 seconds**.

## 2026-09-08 — Individual project transfer and Mermaid

New repeatable gate: `npm run qc:project-transfer` (headed, serial; local offline-enabled production build). Full format contract and JSON example: `docs/formats/PROJECT_TRANSFER.md`; public JSON Schema: `packages/web/public/schemas/project-v1.schema.json`.

| ID | New-user question / persona | Sequence | Required result |
| --- | --- | --- | --- |
| TRANSFER-01 | Student: Can I share just this project? | Import documented example via file chooser, select it, export JSON | Exactly one project; task fields, positions, tags, metadata, links and notes preserved; no auth or sync internals |
| TRANSFER-02 | Parent / team: Will importing overwrite my work? | Reimport export offline, reload | Fresh project/task/link/note IDs; references remapped; original unchanged; durable local copy |
| TRANSFER-03 | Engineer: Can I put this in documentation? | Export Mermaid with adversarial quotes, emoji, HTML and directive-like task text; parse/render locally with Mermaid 11.17.2 | Three readable nodes, directed labeled edge, no executable user syntax; actual SVG screenshot |
| TRANSFER-04 | Any user: What if a file is broken or my disk is full? | Invalid JSON/version/references, mixed valid-invalid backup, >50 MB file, injected IndexedDB put failure | Visible error, zero partial imports; later saves still work |
| TRANSFER-05 | Large team: What are the limits? | 300 tasks / 600 links / 2,000 full-length notes round trip; over-limit project; account with 100 cloud summaries | Full-size data round trips; excess rejected without saving |
| TRANSFER-06 | Mobile user: Can I reach every action? | Click JSON export, Mermaid export and import file chooser at 320×568, 390×844, 844×390, 1024×768, 1440×900, 2560×1440; actual import at 320 portrait | Downloads work; buttons fit; menu is bounded and scrolls only its contents; no page overflow |
| TRANSFER-07 | Returning user: Can I preserve notes for deleted tasks? | Export historical note whose task no longer exists | Note body and author label preserved as a project note |

Evidence: 26 unit/schema/reconciliation tests passed (including 1,000 deterministic merge cases). Local transfer headed gate passed in 12.7 s; local offline headed regression 3/3 passed in 49.8 s. Actual local Worker/D1/DO sync fixture passed owner isolation, idempotent replay, atomic races, real REST agent revision conflict and 8 MB notes download. Production build/typecheck passed. Mermaid/Ajv are dev-only validation dependencies and do not ship in the app bundle. Screenshots under ignored `test-artifacts/quality/project-transfer-*.png` and `project-mermaid.png`.

Scope: hosted/offline-enabled app. Mermaid is export-only and omits notes, descriptions, dates, priorities and exact layout; use JSON for restoration. This is targeted transfer/offline validation, not a claim of exhaustive browser or security coverage.
