# Coverage and limits

No current suite proves that every button, menu, role and failure mode works. Passing a route render is not interaction coverage. A test which skips, catches a failed click, returns when data is absent, or only checks that some nodes render is not a release gate for that action.

| Area | Repeatable evidence | Remaining gate |
|---|---|---|
| Entry and responsive dialogs | `guest-dialog-layout`, `graph-details`, `admin-dialog-responsive` | Real account recovery, provider failures, mobile keyboard, native assistive technology |
| All eight workspace modes | `new-user-modes` at three sizes | Every filter, sort, date control, selection and bulk action |
| Task lifecycle | Six `persona-lifecycle` scenarios, saved notes/status/date | Multi-actor assignment, conflicts, retry after interrupted save |
| Graph interactions | `user-smoke`, `graph-details`, `graph-motion`, `graph-resize` | Strict connection menu matrix, labels crossing cards, dense graph interaction budgets |
| Layout | `graph-layout`: 12 stacked, 50 and 200 connected cards | Larger sizes, edge routing and intentional collapsed groups |
| Security | Cloud `test-multiple-graphs`, `test-security-limits` | Core role/ownership matrix, expiry/replay, session fixation, injection/XSS, upload/export, dependency remediation |
| Cost bounds | Local D1 eight concurrent batches at 295/300 nodes | Distributed Worker concurrency, edge/project quotas, rate-limiter binding, long soak |
| Release | Build/typecheck/unit checks and Pages artifact script | Exact deployed artifact, migrations, rollback and live account journey |

## Control inventory rule

Each action needs: stable name, route/view, actor permission, initial state, pointer/touch/keyboard input, expected visible result, persistence or rejection assertion, and test reference. Destructive actions use owned disposable fixtures. An enumerated control is DISCOVERED until its result is asserted; a crawler clicking everything does not prove correctness.

Start with graph-first controls: graph selector/create/switch; new item/create/cancel; node open/close; title/description; every type and status; priority keyboard/touch; note add/edit/delete; details/save/cancel; dates/tags; grow/connect/cancel; relationship type/reverse/delete; undo/redo; zoom/frame/pan; layout and minimap. Then apply the same format to each alternate view, account, settings and administrator page.

## Stress procedure

Run one headed browser at a time on localhost with disposable graphs. Increase dataset size and concurrency separately. Record node/edge count, viewport, quality setting, load time, full rendered count, actual successful drag, frame gaps, interaction latency, API p50/p95, settling time, overlap counts and persistence after reload. Stop escalation on sustained unresponsiveness, server errors or failed correctness; retain the failing size. A maximum tested size is not the application limit. Do not run the entire unbounded MCP chaos suite alongside the browser: its previous run exhausted memory.

Security demand-control checks follow the [OWASP GraphQL testing guidance](https://github.com/OWASP/www-project-web-security-testing-guide/blob/master/v42/4-Web_Application_Security_Testing/12-API_Testing/01-Testing_GraphQL.md). They complement authorization, payload, request-rate and data-volume limits; no single depth check establishes security.

## Runtime and evidence incidents

- [2026-10-23 runtime validation](RUNTIME_VALIDATION_2026-10-23.md): API peer-resolution failure after a successful build, obsolete Node/container minimums, a missing disposable-DB CI marker, and smoke assertions depending on a populated default graph.

- 2026-10-23 mobile login evidence: a headed 360px admin scenario successfully signed in but the shared helper checked only the hidden desktop selector/user menu. It retried login on the authenticated workspace and ultimately reported a missing password field. Include the existing visible `graph-selector-mobile` marker in the positive workspace indicators; retain the login-form exclusion. Reproduce with `tests/e2e/graph/admin-dialog-responsive.spec.ts` at 360, 844, and 1440px. This helper observes workspace entry; it is not a complete session/identity authorization test. The initial failure screenshot and log are retained in the audit artifacts.

- The same admin scenario also assumed the Users panel was the default; the current default is Feedback & operations. Navigate through the visible Users button before opening Create User. Keep the dialog visibility, focus, viewport, dismissal, and focus-restoration assertions intact.
