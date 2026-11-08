# End-to-end scenario catalog

Use needs and context, not assumptions about age, gender or technical ability. A parent can also be an engineer; a scientist may be a first-time user. Every actor needs a clear outcome with minimal bookkeeping.

## Standard scenario format

Each scenario records: **ID; actor(s) and permissions; team size; goal; preconditions and data; device/input; ordered action → expected result steps; recovery/adversarial variants; cleanup; automation/evidence; result and remaining gaps.**

The machine-readable single-actor cases are in `tests/fixtures/quality/personas.json`; `persona-lifecycle.spec.ts` executes their actions. Setup creates an isolated empty graph using the API; task creation, notes and status changes use the UI; independent API readback and reload verify persistence. Core currently uses the seeded development ADMIN test account (a MEMBER fixture is not available); local D1 uses an ephemeral guest. This is not evidence of multi-user collaboration or scale.

| ID | Actors / context | Outcome and distinct risk | Main journey | Recovery / adversarial variant | Gate evidence |
| --- | --- | --- | --- | --- | --- |
| HOME-01 | Parent, individual household organizer | Prepare a school trip without project-management jargon | Create → note → complete → return on phone | Interrupt work; rotate; return without duplicate tasks | Automated lifecycle + responsive gate |
| STUDENT-01 | Student in a group of 4 | Prepare a reproducible project demo for review | Create → record evidence → request review → reload in landscape | Teammate disagrees; return to active work without losing notes | Automated single-actor lifecycle; actual handoff required below |
| SOLO-01 | Independent engineer | Fix an inaccessible login form | Create → record verification → complete → inspect totals | Network fails during save; text retained and retry is safe | Automated happy path; failure recovery remains a release check |
| TEAM-01 | Community-event coordinator, team of 6 | Surface a venue/accessibility blocker before invitations | Create → explain blocker → mark blocked → inspect activity | Blocker clears; downstream work becomes understandable | Automated single-actor lifecycle; dependency journey required below |
| LARGE-01 | Release coordinator, organization of 60 | Request review with visible evidence and outstanding risk | Create release review → record evidence → request review → return | Simultaneous updates, restricted graphs, many projects | Automated single-actor lifecycle; does not simulate 60 users |
| RESEARCH-01 | Researcher, aerospace team of 12 | Reproduce a simulation with assumptions and units documented | Create → record reproducibility note → request review → reload on tablet | Invalid inputs; conflicting findings; independent reviewer rejects result | Automated single-actor lifecycle; no scientific validity claim |
| COLLAB-01 | Student author + peer reviewer, 4-person team | Complete an actual two-account handoff | Author creates → reviewer opens same work → comments → author revises → reviewer accepts | Viewer attempts a write and is rejected server-side | BLOCKED until two-account UI and authorization evidence exists on target backend |
| COLLAB-02 | Coordinator + volunteer, 6-person team | Unblock dependent work | Create prerequisite/dependent → connect → assign → volunteer completes prerequisite → coordinator verifies | Wrong connection → remove/undo → reload integrity | Core grow/undo smoke and D1 edge contract are partial; full handoff BLOCKED |
| COLLAB-03 | Two engineers editing concurrently | Preserve both users' intentions | Open same task in two sessions → interleaved updates → refresh | Conflict detected or reconciled; no silent lost update | BLOCKED: concurrency policy and full journey not verified |
| LARGE-02 | Admin, team lead, editor, viewer, outsider | Keep private work private at larger scale | Create separate teams/graphs → switch contexts → authorized edit → unauthorized read/write attempts | Stale access after role removal, guessed IDs, cross-graph links | D1 cross-account CRUD isolation partial; membership/role matrix BLOCKED |
| LARGE-03 | 60 users across 8 projects | Find useful work quickly under realistic volume | Seed 1,000 tasks across owned projects → search/filter → edit → return | Pagination, quotas, slow network, bounded D1 reads | BLOCKED pending measured load/interaction budgets; never seed production |
| RESEARCH-02 | Analyst + independent reviewer | Preserve evidence and distinguish a note from an audit trail | Record model/version/units → attach references → review → correction | Editable notes must not pretend to be immutable evidence | Activity explicitly distinguishes notes; full evidence workflow BLOCKED |
| AI-01 | Human coordinator + API-writing AI contributor | Observe genuine progress without agent-management clutter | Human opens work → API records progress → human sees update → returns later | Failed API update; duplicate delivery; spoofed actor | Core recorded-AI and local D1 progress checks partial; verified attribution/idempotency BLOCKED |
| AI-02 | Human approver + managed autonomous agent | Delegate with clear ownership and approval boundaries | Request outcome → agent claims → progress → review → human accepts | Lease expires, agent fails, duplicate claim, unauthorized action | DEFERRED to managed product; Core must not claim autonomous execution |
| ACCESS-01 | Keyboard-only or screen-reader user | Create, edit and recover without pointer/hover | Navigate → open → edit → close → restore focus | Zoom, forced colors, reduced motion, mobile keyboard | Keyboard/rotation checks partial; native AT evidence BLOCKED |
| ACCESS-02 | Any user on intermittent mobile data | Keep work through interruption | Edit → disconnect → save → reconnect → retry → reload | Expired credential, duplicate request, unsaved navigation | BLOCKED until failure and recovery assertions pass |
| ENTRY-01 | First-time guest → returning account holder | Know what saves and how long it lasts | Visit deep link → try guest → create → return/sign in | Expired guest, unavailable email provider, disabled guest writes | Layout and D1 persistence partial; remote account flow BLOCKED |
| RELEASE-01 | Returning user after deployment | Open bookmarked work on the exact live build | Static deep link → assets → intended API → saved graph | Old cached HTML, migration rollback, API unavailable | Staged artifact gate + release ledger; remote verification required |

## Motion and graph-first interaction gate

**MOTION-01:** Any user arranging their work in Graph view. Use pinned tasks with an active status at 390×844, 844×390 and 1440×900. Verify a real pointer drag moves the saved coordinates by more than 20 graph units (a missed drag must fail). A fully placed graph must return to rest within two seconds of release. Change type through the visible editor, rotate an open phone graph, then sample every animation frame for 17 seconds, crossing the normal poll interval. Node anchor positions must span no more than one screen pixel on either axis. Record samples and screenshots. Measure translation independently of intentional glow/scale effects.

`npm run qc:motion` executes this gate; it is also included in `qc:new-user`. Settling unplaced/dense graphs, connected-node dragging, edge-label shaking and rapid create/delete/switch sequences require additional cases; the pinned-node baseline alone must not claim complete animation coverage.

**MOTION-02:** Resize a loaded graph from 1000×700 through small desktop increments up to 1920×1080, shrink it again, rotate between 390×844 and 844×390, and expand back to desktop. After every change, the card bounds must be centered within three pixels and remain inside the graph viewport. Saved node coordinates must remain identical. `graph-resize.spec.ts` runs headed in `qc:motion`, `qc:graph`, and `qc:new-user`. This specifically catches incremental resizing below the former 20% threshold.

**GRAPH-FIRST-01:** Create a new private graph through its UI; create a first task; drag it; grow and name a connected task; edit details and progress; change a connection; undo; reload. Keep Graph view selected throughout. Record the actual UI actions and saved result. Use a disposable named graph in local development and retain a screenshot per important step. The hands-on pass uses the visible headed browser; API calls may verify results but may not substitute for these UI actions.

## Execution and coverage rules

- Run `TEST_URL=http://localhost:3127 npm run qc:personas` for Core, and `QC_BACKEND=cloud QC_API_URL=http://localhost:8797/api/graphql TEST_URL=http://localhost:3129 npm run qc:personas` for local D1. Both run headed and serial.
- The six automated fixtures deliberately cover completion, blockage, review, portrait, landscape, tablet and desktop. Pair them with all-mode tests, guest/accessibility checks, relationships and account-isolation tests.
- A renamed task is not proof of a different team's workflow. The collaborative, concurrent, permission and scale scenarios above require distinct actors and assertions before passing.
- Record backend, source revision, scenario ID, device, evidence path, result and limitation in `RELEASE_QC.md`. Do not turn BLOCKED into PASS because a related single-user test passed.

## AGENT-COLLAB-01 — a human and their agent share a project

- **Persona:** a parent planning an event, a student coordinating a project, or an engineer preparing a release; repeat with realistic titles and priorities.
- **Environment:** disposable owned Core project; 390×844, 844×390, 1440×900; headed Chromium. Cloud contract uses isolated local D1 account.
- **Goal:** delegate a review, see progress and a reply, then remove access without leaving the graph.
- **Sequence:** open Your agent → name and create collaboration token → privately copy instructions → human leaves a project note → agent reads context → updates a task's priority/status → leaves a task note → human sees attributed reply → revoke → confirm agent is denied → create read-only token → confirm reading works but writing is denied → revoke and close with Escape.
- **Expected:** same persisted task appears in the graph; notes identify human/agent using server authentication; no login token is shared; no credential can cross projects or create more credentials. Closing the panel hides the raw token. Panel remains within the viewport.
- **Negative cases:** nonexistent task in note, priority outside 0–1, wrong project, read-only write, revoked access, forged author field; local D1 additionally forces expiry.
- **Automation:** `qc:agents`; Cloud `scripts/test-agent-connections.mjs`. No autonomous model execution is simulated or claimed.
- **Remaining variants:** separate collaborating human accounts, large note history, native mobile keyboard, hosted browser staging, provider-specific agent connection instructions.
