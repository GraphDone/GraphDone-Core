# Core merge validation — 2026-10-23

## Current disposition — 2026-10-23, 22:29 UTC snapshot

The final frozen PR #157 head
`385e7679fabc60b80cd65cf0a1aa4cdf3d592514` passed public
[CI run 40025965786](https://github.com/GraphDone/GraphDone-Core/actions/runs/40025965786)
and [Comprehensive Test Suite run 40025965837](https://github.com/GraphDone/GraphDone-Core/actions/runs/40025965837).
The independently inspected
[browser artifact 12533273048](https://github.com/GraphDone/GraphDone-Core/actions/runs/40025965786/artifacts/12533273048)
records smoke **6**, new-user **42**, mobile **27** and performance **3** passes;
the separate living-graph suite passed **3**. The completed validation also
records **603 unit passes with 26 explicitly DB-gated skips**, **161 harness
passes** and **9 real disposable-database contract passes**. Required browser
cases did not pass through skips or flaky retries. Earlier failures below remain
part of the record.

After the owner's explicit standing authorization changed **only `dev`
administrator enforcement**, PR #157 merged through native `--admin` at
`9068cd31824991330c6d92196654e53e04e29063`. Its parents are
`8a7de052eb60fe517f45681dc42b5b169d09c660` and the frozen `385e767` head;
its entire tree `6bf014bcc30eb6e21c0deeae4db9c7d4effeaac2` equals that validated
source. Other protections remain unchanged. This was an owner-authorized
administrative merge, not a non-author approval, deployment or hosted-acceptance
claim. See the [current dev integration policy](../../.agents/playbooks/dev-admin-integration.md).

Post-merge CI was still running at this snapshot. Final checks on the latest
resulting `dev` head and issue closure are not claimed here;
[issue #156](https://github.com/GraphDone/GraphDone-Core/issues/156) is the
authoritative post-merge/closeout record. The sections below preserve earlier
snapshots: their **PENDING** review/CI wording describes those earlier states,
not a reversal of the confirmed results above. Remaining release limits still
apply.

## Follow-up: the fresh production audit held final approval

The snapshot below remains historical evidence. On the subsequent clean merged
head `78a90cc7899e44c33aa27117bccb19ea7cbe85f6`, a new pinned installation passed
build, 590 unit tests (25 explicitly DB-gated skips), 161 harness tests, types,
lint, bundle and eight real Neo4j contract checks. Its production high/critical
audit instead exited 1 with eight moderate findings plus the Zod high advisory
[GHSA-mrhx-c7xc-m3w5](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5). That
fresh failure blocked final approval despite the earlier green CI response.
The exact metadata/cache cause of the discrepancy is not established.

The [bounded-validation and consumer-compatibility lesson](../../.agents/inbox/2026-10-23-zod-constrained-collections.md)
records the targeted Zod 4.6.7 correction and unchanged MCP SDK 1.32.2. The same
13 small regression fixtures fail five cases on the old dependency and pass
all 13 on the patch. The patch's build and production audit pass; a complete
unit run at `ea46e39` passes 603 cases with 25 DB-gated skips. The SDK's actual
dependency path is verified, including avoiding a nested patched copy that
would leave its hoisted dependency vulnerable. CI gives only the audit step a
fresh per-attempt cache; the threshold is unchanged. These results do not prove
unbounded-collection protection, full MCP denial-of-service resistance or a
hosted deployment. Final combined public CI and protected review remain pending.

The subsequent combined candidate
`df1fac165a5f1421602c3706db8b86090b54a4f5` includes the separate MCP stdout
correction in [PR #179](https://github.com/GraphDone/GraphDone-Core/pull/179)
and the dependency correction in [PR #180](https://github.com/GraphDone/GraphDone-Core/pull/180).
A fresh install on that clean, unchanged source passes build, **603 unit cases
with 26 DB-gated skips**, **161 harness cases**, types, lint, bundle, and the
fresh-cache production audit (zero high/critical, eight moderate). All **nine
real Neo4j contract cases** pass, including the actual MCP entry point's
create/read/error/recovery path, verified fixture cleanup and zero protocol
parse errors through shutdown. A separate compiled production-mode MCP probe
also initializes, lists 31 tools, reads an owned two-node/one-edge graph,
rejects malformed/unknown calls and recovers, with zero stdout protocol errors
and confirmed child/edge/node/graph cleanup. It is a one-off probe, distinct
from the committed nine-case contract. Evidence is retained in
`core-mcp-final-candidate-20261023/test-artifacts/audit-20261023/{final-mcp-combined,zod-stdio}/`.
These local combined results do not replace final public-head CI or a real
non-author approval of protected PR #157.

## Earlier functional integration snapshot

**Snapshot: all planned local gates pass and the scoped stack is merged into
the public audit branch. Final public integration CI and protected `dev` merge
approval remain PENDING.** Public functional integration:
`84f1c0d132a6fda6a6bc13270363cf18b69a89f0`. Its entire Git tree
`f5a394d442193a502ffa144022fcdcfeb8889f90` matches the tested local candidate
`bdf82ccdd79bbc4c21ce4833023f78596a1be4a8`, including reviewed test/lesson-only
PR #177. That candidate's only changes from `e120df4b849969854ffe529a64df3d42498ae4cf` are
the touch test and two lesson/index files; no application code changed. The
passing new-user, smoke and performance runs tested clean, unchanged `e120df4`,
which includes reviewed evidence-only PR #176. Earlier
new-user and mobile runs failed on clean frozen
`f8a11e16a593738d485547eb1dfe117438cc3ed6`. Earlier combined checks ran on clean
`b009245035559fccadd350a02c106b6da42347c6`. Between `b009245` and `f8a11e1`, a
type-only server annotation and performance-evidence update left all 35 rebuilt
runtime JavaScript files unchanged (`type-only-runtime-equivalence.json`).
PR #176 adds diagnostics and safe evidence retention, not an application fix.
Do not relabel earlier runs as having run at a different SHA. These Core merge
checks do not establish deployed health, hosted D1 parity or fulfillment of all
62 [new-user acceptance questions](NEW_USER_GATE.md). A separate, bounded live
entry-page observation is recorded below.

The audit uses Node 22.23.4, lockfile-installed dependencies, bundled Chromium,
and an owned local Core/Neo4j stack (web `127.0.0.1:13127`, API `127.0.0.1:14127`).
Required new-user, mobile and performance runs explicitly use one worker and
zero retries; the standalone living-graph run also pins zero retries. The smoke
manifest inherits the configured retry count (two in CI), while its strict
adapter rejects flaky or retried outcomes. Mutable fixtures belong to each test;
delete edges before work items and their graph, stopping cleanup on error.
Never enable the disposable-database contract marker against a shared database.

## Separate live entry-page observation

At **2026-10-23 20:42 UTC**, a read-only browser probe of
`https://graphdone.com` at 1440×900 and 390×844 recorded HTTP 200, visible guest
and email-entry controls, no JavaScript/request/HTTP errors and no horizontal
overflow. The desktop and phone screenshots were inspected. No control was
clicked, no form was submitted and no data was authored, so this establishes
entry-page availability only; it does not prove authentication, guest data,
email delivery, graph operations or persistence.

The first probe at 20:40 UTC timed out waiting for a `main` element despite
HTTP 200 and the rendered sign-in controls. Both pages recorded `mainCount: 0`
in the corrected controls-based probe. Retain that failed assumption separately
from the successful entry check: it is not outage evidence, and the missing
main landmark remains an accessibility limitation, not a passed accessibility
audit.

The public release metadata still reported Core
`f8fb968567dbd80767ea738d4ab9892c1042bdd7`, Cloud
`304629e0ef0b294a0025977a87c2cf106dfe41b9`, built
`2026-09-13T23:38:21.838Z`. The public health response reports worker liveness
with `db: not_probed`; it is not database health evidence. These observations
do not show deployment of this audit's reviewed changes. JSON reports and
screenshots are retained separately under the Cloud checkout's
`test-artifacts/assessment-2026-10-23/{live-browser,live-browser-controls}/`.

## Public review and integration state

The 19 scoped PRs below are now merged, directly or through their stacked parent
branches, into `audit/core-validation-20261023`. The final integration merge
#161 was confirmed publicly at `84f1c0d` on 2026-10-23 at 20:48 UTC. This is not
a merge to `dev` or a deployment. [Integration PR #157](https://github.com/GraphDone/GraphDone-Core/pull/157)
remains open; required final CI and human approval remain pending. The five-file
documentation follow-up is based on `84f1c0d`, so it does not republish the audit
implementation as a documentation patch.

The matrix preserves each original reviewed scoped head. Stacked child merges
advanced some parent heads; the separate merge column records the actual
confirmed merge and its target. The retained audit merge record and Git
ancestry checks establish that all 16 new merge commits, plus earlier
#159/#164/#165, are included in `84f1c0d`. Independently compared Git trees are
identical between that public composition and tested `bdf82cc`.

The API merge attempt for #170 stopped on an OAuth `workflow`-scope refusal.
The already configured SSH credential was verified as the same account;
ordinary merge pushes subsequently completed #170, #174 and #161, with their
remote/PR states checked. [The operational record](../../.agents/inbox/2026-10-23-pr-base-ref-is-not-live-tip.md#a-workflow-scoped-api-refusal-needs-its-own-evidence)
preserves the rejected command, identity response and confirmed follow-up
commits. No permissions were expanded, and `dev` protection remains unchanged.

| PR | Scope | Reviewed scoped head | Confirmed merge |
| --- | --- | --- | --- |
| [#159](https://github.com/GraphDone/GraphDone-Core/pull/159) | Strict evidence and owned output paths | [13acecc](https://github.com/GraphDone/GraphDone-Core/commit/13acecc9cce2b391c10b2ceb87adb9350a4f13b9) | Merged into audit integration: [7504d0d](https://github.com/GraphDone/GraphDone-Core/commit/7504d0daa229eb5a8fe93ecbbb40d6e478183669) |
| [#164](https://github.com/GraphDone/GraphDone-Core/pull/164) | Owned process-group timeout cleanup | [f9d89cb](https://github.com/GraphDone/GraphDone-Core/commit/f9d89cb2939d1acfb6919dc2355990f29d3f9ef0) | Merged into audit integration: [1f04f9b](https://github.com/GraphDone/GraphDone-Core/commit/1f04f9b7cb5567b48f49a8e27493881f6cc17fa5) |
| [#165](https://github.com/GraphDone/GraphDone-Core/pull/165) | Deterministic MCP CPU tests; production guard retained | [d0561bf](https://github.com/GraphDone/GraphDone-Core/commit/d0561bf05bf551708b75745fcb64c2f23209e4aa) | Merged into audit integration: [100625e](https://github.com/GraphDone/GraphDone-Core/commit/100625e58a01d282082e9d1fd74d61020f01f842) |
| [#158](https://github.com/GraphDone/GraphDone-Core/pull/158) | Layout queue lifetime/owner isolation; safe bulk deletion | [f364a9c](https://github.com/GraphDone/GraphDone-Core/commit/f364a9cee0cbd594478be0941088098c0b0af6ce) | Merged into audit integration: [1fb39b0](https://github.com/GraphDone/GraphDone-Core/commit/1fb39b004b94ede6868727eb8b7fa5ca2e902ed2) |
| [#160](https://github.com/GraphDone/GraphDone-Core/pull/160) | Folder/current-role and descendant authorization | [ec8090d](https://github.com/GraphDone/GraphDone-Core/commit/ec8090d5df6d299e752ece9e74c081b178c1317d) | Merged into audit integration: [5de5d52](https://github.com/GraphDone/GraphDone-Core/commit/5de5d5278e2c9d93c196a01a0b529b0e7c62cdcc) |
| [#161](https://github.com/GraphDone/GraphDone-Core/pull/161) | Node/Apollo/dependency/runtime and CI gates | [5f0f454](https://github.com/GraphDone/GraphDone-Core/commit/5f0f454259f45a847de14e6ccc6f05f426b6868e) | Merged into audit integration: [84f1c0d](https://github.com/GraphDone/GraphDone-Core/commit/84f1c0d132a6fda6a6bc13270363cf18b69a89f0) |
| [#163](https://github.com/GraphDone/GraphDone-Core/pull/163) | Mobile login/admin fixture controls | [c04fbac](https://github.com/GraphDone/GraphDone-Core/commit/c04fbacf792303893cdf60669873c87221866936) | Merged into [#161's branch](https://github.com/GraphDone/GraphDone-Core/pull/161): [c8d634d](https://github.com/GraphDone/GraphDone-Core/commit/c8d634d3a8e95f9a06a73760a1e9599dcd795791) |
| [#166](https://github.com/GraphDone/GraphDone-Core/pull/166) | Saved-state and recorded-AI browser fixtures | [e6cf1ac](https://github.com/GraphDone/GraphDone-Core/commit/e6cf1ace2bf5addb4cbcba7b13fab20ddc599210) | Merged into [#163's branch](https://github.com/GraphDone/GraphDone-Core/pull/163): [827a854](https://github.com/GraphDone/GraphDone-Core/commit/827a854ede8f18840aa410ec6f8b4da4eee5d3bc) |
| [#167](https://github.com/GraphDone/GraphDone-Core/pull/167) | Real drag/failure/Graph–List–Graph recovery | [5a4a8e3](https://github.com/GraphDone/GraphDone-Core/commit/5a4a8e3fbe3fd5db500e83f010799fe01d596ea7) | Merged into [#161's branch](https://github.com/GraphDone/GraphDone-Core/pull/161): [eed5c6b](https://github.com/GraphDone/GraphDone-Core/commit/eed5c6b82f04c7372590d87655751b8e43368366) |
| [#168](https://github.com/GraphDone/GraphDone-Core/pull/168) | Lint matcher correction; residual security inventory | [ddb4407](https://github.com/GraphDone/GraphDone-Core/commit/ddb44079ed2f8f3f1d702716a1711f5885283911) | Merged into [#161's branch](https://github.com/GraphDone/GraphDone-Core/pull/161): [dd447c6](https://github.com/GraphDone/GraphDone-Core/commit/dd447c6df44afb4ed3f51992be49aaaa55019699) |
| [#169](https://github.com/GraphDone/GraphDone-Core/pull/169) | Single-use magic-link consumption | [7e91d1a](https://github.com/GraphDone/GraphDone-Core/commit/7e91d1a59c9ae9051569d8ef711ef6619f921bd6) | Merged into [#161's branch](https://github.com/GraphDone/GraphDone-Core/pull/161): [8b93344](https://github.com/GraphDone/GraphDone-Core/commit/8b93344e985d314fb9b75dfe846d174a772fb56a) |
| [#170](https://github.com/GraphDone/GraphDone-Core/pull/170) | Production signing-secret startup validation | [bc483d2](https://github.com/GraphDone/GraphDone-Core/commit/bc483d21d74e787d7807a909757fb2538e0cea14) | Merged into [#161's branch](https://github.com/GraphDone/GraphDone-Core/pull/161): [dcbd5e2](https://github.com/GraphDone/GraphDone-Core/commit/dcbd5e29ae68e90788855d86b15455b2374fdbd6) |
| [#171](https://github.com/GraphDone/GraphDone-Core/pull/171) | Server-side GraphQL password-attempt accounting | [46388cb](https://github.com/GraphDone/GraphDone-Core/commit/46388cb62acfa198f13b294621216bf6cb1cb799) | Merged into [#161's branch](https://github.com/GraphDone/GraphDone-Core/pull/161): [69d36e3](https://github.com/GraphDone/GraphDone-Core/commit/69d36e33d26336892ee705dfe3e922dbb28a7a6d) |
| [#172](https://github.com/GraphDone/GraphDone-Core/pull/172) | Rendered navigation/camera acceptance | [041fa51](https://github.com/GraphDone/GraphDone-Core/commit/041fa51ace6d056db2108ce15779c6ea193e01a0) | Merged into [#166's branch](https://github.com/GraphDone/GraphDone-Core/pull/166): [25838b4](https://github.com/GraphDone/GraphDone-Core/commit/25838b405cf78079c94b231409747679e42ffe95) |
| [#173](https://github.com/GraphDone/GraphDone-Core/pull/173) | Owned mobile-dialog fixtures and Escape dismissal | [3c648cb](https://github.com/GraphDone/GraphDone-Core/commit/3c648cbbe3a08b664492bb0283dea6ecfa1572d4) | Merged into [#172's branch](https://github.com/GraphDone/GraphDone-Core/pull/172): [7fec50b](https://github.com/GraphDone/GraphDone-Core/commit/7fec50b5437ff5561cd884fa1558835aa3bbded5) |
| [#174](https://github.com/GraphDone/GraphDone-Core/pull/174) | Newer draft retention and scoped undo completion | [9b0c050](https://github.com/GraphDone/GraphDone-Core/commit/9b0c05035b5d562a74978badd076680ed86dded7) | Merged into [#161's branch](https://github.com/GraphDone/GraphDone-Core/pull/161): [5f834b1](https://github.com/GraphDone/GraphDone-Core/commit/5f834b1947face3b281093a00a1a29e18ab135c2) |
| [#175](https://github.com/GraphDone/GraphDone-Core/pull/175) | Measured first/final graph metrics; strict mobile/perf gates | [1a16d4e](https://github.com/GraphDone/GraphDone-Core/commit/1a16d4ea9a5e2b33fe8604336351a7e08a76d73c) | Merged into [#161's branch](https://github.com/GraphDone/GraphDone-Core/pull/161): [285f462](https://github.com/GraphDone/GraphDone-Core/commit/285f4623d6756ea8647c9d93cd6395cebe81d4c2) |
| [#176](https://github.com/GraphDone/GraphDone-Core/pull/176) | Failure traces/route diagnostics and owned, symlink-safe attachment copying | [a494741](https://github.com/GraphDone/GraphDone-Core/commit/a494741d0d3e58910b903135ec8898e00697918a) | Merged into [#175's branch](https://github.com/GraphDone/GraphDone-Core/pull/175): [0f12b1d](https://github.com/GraphDone/GraphDone-Core/commit/0f12b1d36aca0058eb1edf12c034ca44247a695a) |
| [#177](https://github.com/GraphDone/GraphDone-Core/pull/177) | Owned locked-touch editing, exact saved-title/readback and reload acceptance | [98c5b73](https://github.com/GraphDone/GraphDone-Core/commit/98c5b7313130bedea243ce53abfb36e86ce5bb2e) | Merged into [#173's branch](https://github.com/GraphDone/GraphDone-Core/pull/173): [a4bc803](https://github.com/GraphDone/GraphDone-Core/commit/a4bc803713390578737274138f1c6f6d31f8b6c2) |

## Retained failures and corrective evidence

The first strict 42-case browser gate on clean
`aece6797ef61b21665c924762fb8c9ff68870c3a` finished with **36 passed and six failed
browser cases**. The adapter added one synthetic failed execution-evidence case
for process exit 1, so its report contains **43 cases: 36 passed, seven failed**.
The synthetic case is not a seventh product failure. The report records unchanged
source throughout, `timedOut: false`, and zero skips. Retain the **core-validation
worktree's** `test-artifacts/audit-20261023/strict-new-user/{report.json,report.html}`
and screenshots; these are not in the final-candidate worktree. Do not replace
them with a later passing run.

The six browser failures were button-content acceptance; details/date saving at
390px; motion at 844px and 1440px; gradual resize/framing; and all-mode navigation
at 844×390. Five led to [responsive fixture/measurement corrections](../../.agents/inbox/2026-10-23-responsive-acceptance.md).
The sixth exposed the [delayed details-save product race](DETAILS_SAVE_COMPLETION_2026-10-23.md).
An unchanged isolated details rerun passed; deterministic Apollo regressions
retain the failing-before evidence instead of treating that retry as a fix.

The completed strict new-user run on `f8a11e1` then recorded **41 actual browser
passes and one actual failure**, plus one synthetic execution-evidence failure:
**43 reported cases, 41 passed/two failed**, exit 1, in **508 seconds**. Source
and fingerprints stayed unchanged, with zero skips and no process timeout. The
button sweep failed while only the pre-React static shell was visible: `main`
was unavailable at its existing deadline and the artifact showed
**GraphDone Loading...**.
Docker build/export activity overlapped that run; this is an observation, not
proof of resource contention or the cause of the startup failure.

The completed strict mobile run on the same frozen `f8a11e1` recorded **26 actual
passes and one actual failure**, plus one synthetic execution-evidence failure:
**28 reported cases, 26 passed/two failed**, exit 1, in **246 seconds**. Its source
and fingerprints also stayed unchanged, with zero skips and no process timeout.
The failed case expected a node inspector after a single tap; the error DOM
contained **Edit work item** instead. Source review confirmed that touch taps
intentionally open this editor while mouse selection uses the inspector.
[PR #177's dated lesson](https://github.com/GraphDone/GraphDone-Core/blob/98c5b7313130bedea243ce53abfb36e86ce5bb2e/.agents/inbox/2026-10-23-mobile-touch-editor.md)
records the correction: an owned locked graph/task, actual touch input, exact
save acknowledgement, independent readback and reload with unchanged coordinates.
The focused case passed in 14.729s against unchanged `e120df4` application code;
two earlier test-selector failures are retained. The later complete mobile
rerun passed all 27 cases on clean, unchanged `bdf82cc` in 258.703s, exit 0, with
zero failed/skipped cases, no timeout and no evidence errors. Both source
snapshots share fingerprint
`df0dc48120d54af515193eb0be5d74146850bdfaeccc4098dc2dce424ede11b5`.
Its distinct `final-mobile-traced` report preserves the earlier failed run.

[PR #176](https://github.com/GraphDone/GraphDone-Core/pull/176) retains failure-only
traces, labels route/viewport steps and keeps bounded diagnostic attachments.
It restricts downloadable copies to regular files inside the owned artifact
root, rejecting outside-root paths and symlink traversal. It does not change
application behavior, deadlines, retries or acceptance thresholds. The
serialized diagnostic rerun on `e120df4` **passed all 42 cases**, with zero
failed, skipped or synthetic cases, exit 0 and no timeout, in **588.361 seconds**.
Both source snapshots were clean, with unchanged fingerprint
`5d8eb5cc8e034173785f76f3ca5b6b400f8f1388ec71771e3a6ab2e3043f0636`.
The recorded command used the full 12-file new-user selection, headed Chromium,
one worker, zero retries and `--trace=retain-on-failure`. Retain
`final-new-user-traced/{report.json,report.html,sequences/new-user.json}` alongside
the earlier failure. This pass does not identify the startup failure's cause or
establish a runtime fix.

Historical [PR #173 CI run 40013727616](https://github.com/GraphDone/GraphDone-Core/actions/runs/40013727616)
checked merge `cc4e8efca776b79c1be8a725943660037d1deff0` (`3c648cb` into
`041fa51`). Its older direct new-user command discovered 41 cases and inherited
two retries: 40 passed and one was flaky (details at 390px passed on retry 1).
Mobile then recorded 26 passed and the same stale-inspector expectation failed.
That merge lacked #174's save-race fix and #167's added layout case. These are
historical CI observations, not strict acceptance or final integration CI.

Other retained boundaries and their dated lessons:

- [Live Git refs versus PR base metadata](../../.agents/inbox/2026-10-23-pr-base-ref-is-not-live-tip.md):
  the read-only merge inventory stopped when PR `baseRefOid` values disagreed
  with the actual target ref. The API cause remains unknown; record the live
  target and verify the eventual merge head/tree before accepting composition.
- [Runtime/install/container and minimum-Node checks](RUNTIME_VALIDATION_2026-10-23.md),
  [timeout/descendant cleanup](TEST_TIMEOUT_REVIEW_2026-10-23.md), and
  [ambient-CPU test isolation](MCP_CPU_TESTING_2026-10-23.md).
  Combined lint also caught `NodeJS.ProcessEnv` as `no-undef` after builds/types
  passed. PR #170's type-only `Record<string, string | undefined>` follow-up
  preserves the guard behavior; its server lint, typecheck and 29 focused tests
  pass. The corrected integrated lint result is recorded separately below.
- [Queued-save/deletion review](DURABILITY_REVIEW_2026-10-23.md) and its
  [real-browser failure/recovery case](LAYOUT_RECOVERY_BROWSER_2026-10-23.md).
- [Saved-state/recorded-AI fixtures](NEW_USER_GATE_REVIEW_2026-10-23.md) and
  [mobile audit corrections](../../.agents/inbox/2026-10-23-mobile-audit-fixtures.md).
  The initial mobile selection recorded 15 passed, three failed and nine not run;
  focused corrections do not count those nine as passing.
- [Performance evidence](../../.agents/inbox/2026-10-23-performance-gate-evidence.md):
  the corrected owned fixture initially exposed two missing-metric failures and
  one pass on the unchanged app. The corrected three-case browser result is
  recorded below; a small placed fixture does not establish scale limits.
- [Legacy descendant-folder ownership](../../.agents/inbox/2026-10-23-folder-delete-legacy-hierarchy.md),
  [magic-link replay](MAGIC_LINK_REPLAY_2026-10-23.md),
  [production secrets](PRODUCTION_SECRETS_2026-10-23.md), and
  [password-login limits](PASSWORD_LOGIN_LIMITS_2026-10-23.md).
  These are bounded local tests, not a complete authentication/security audit.

## Final combined evidence — to be completed before merge

Completed runs retain their recorded verdict below; unexecuted gates remain
**PENDING**. Earlier scoped counts must not be copied here as combined results.
Fill each row with the command actually run, source SHA,
passed/failed/skipped/unexecuted counts, exit code and durable artifact/CI link.
For unified reports, verify matching start/end source fingerprints, intended
backend/target, complete discovery, and no missing, flaky or synthetic-failure
evidence. A successful wrapper exit or a skipped required case is not a pass.

Unified browser reports capture their own start/end source. Other exact-head
attributions below use recorded audit commands and reflog, not a SHA embedded
in each log. Corrected lint ran at
`599ffc00d0d47f984cebed9a8f6fba57f6d77b46`; bundle validation ran at `f8a11e1`,
and audit/HTTP checks at `b009245`. The clean install preceded final composition;
its exact checkout was not captured, so it is not relabeled as `b009245`. The
installed lockfile remained unchanged through the candidate.

| Gate and reproducible entry | Scope / required record | Final result |
| --- | --- | --- |
| `npm ci --legacy-peer-deps` | Clean pinned install before final composition; same lockfile, exact checkout not captured | **PASS**, exit 0. `final-candidate-clean-install.log` |
| `npm run perf:bundle` | Largest gzipped JS chunk 265.8kB against 450.0kB budget | **PASS**, `f8a11e1`, exit 0. `final-bundle-budget.log` |
| `npm run build`; `npm run typecheck` | All workspaces; preserve warnings | **PASS**, `b009245`, both exit 0. `final-integrated-build.log`, `final-integrated-types.log` |
| `npm run lint` | All workspaces after the type-only secret-validator correction | **PASS**, `599ffc0`, exit 0: zero errors, existing warnings remain. `final-integrated-lint-corrected.log` |
| `npm run test` | Combined core/web/server/MCP unit results; report DB-gated skips separately | **PASS**, `b009245`, exit 0: 590 passed (41 core, 326 web, 126 server, 97 MCP); 25 explicitly DB-gated skips. `final-integrated-unit.log` |
| `npm run test:unified:lib` | Discovery, evidence rejection, process ownership, dependency and performance-fixture contracts, plus #176 diagnostics | **PASS**, `e120df4`, exit 0: 161 passed, zero failed/skipped. `final-harness-with-diagnostics.log`. Earlier `b009245` result: 151 passed, exit 0, `final-integrated-harness.log` |
| Owned startup probes of the built API and generic container images | Configured secrets; `/health`, Neo4j and login/authenticated `me` readback; image IDs in JSON | **PASS**, `f8a11e1`: both images healthy with authenticated readback. `final-images-runtime.json`; exact probe shell command/exit not recorded in that JSON |
| Start the same two built images without production secrets | Negative startup control; expected process rejection | **PASS**, both reject missing secrets with expected exit 1. `final-image-secret-rejection.json`; same `f8a11e1` images per execution record |
| In `packages/mcp-server`: `RUN_DB_CONTRACT=1 GRAPHDONE_DISPOSABLE_NEO4J=1 npx vitest --run tests/neo4j-contract.test.ts` | Owned disposable Neo4j only | **PASS**, `b009245`, exit 0: 8 passed. `final-integrated-db-contract.log` |
| `python3 /tmp/graphdone-folder-http.py` | One-off owned-account HTTP probe, not a committed regression harness; scope below | **PASS**, `b009245`, exit 0: 8 checks. `final-folder-real-http.json` |
| `xvfb-run --auto-servernum node tests/run-unified.mjs --sequence smoke --out test-artifacts/audit-20261023/final-smoke` | Actual Core UI/API journeys, layout recovery and cleanup | **PASS**, unchanged clean `e120df4`, exit 0, 101.422s: 6 passed, zero failed/skipped, no timeout or evidence errors |
| `xvfb-run --auto-servernum node tests/run-unified.mjs --sequence new-user --out test-artifacts/audit-20261023/final-new-user` | Full strict headed selection, zero retries | **FAIL**, unchanged clean `f8a11e1`, exit 1, 508s: 41 actual passes/one actual failure plus one synthetic failure (43 report cases); zero skips, not timed out |
| `xvfb-run --auto-servernum node tests/run-unified.mjs --sequence new-user --out test-artifacts/audit-20261023/final-new-user-traced` | Serialized rerun with #176 retained route/trace evidence; headed, one worker, zero retries | **PASS**, unchanged clean `e120df4`, exit 0, 588.361s: 42 passed, zero failed/skipped/synthetic cases, not timed out |
| `xvfb-run --auto-servernum node tests/run-unified.mjs --sequence mobile --out test-artifacts/audit-20261023/final-mobile` | Complete mobile/audit selection, zero retries | **FAIL**, unchanged clean `f8a11e1`, exit 1, 246s: 26 actual passes/one actual failure plus one synthetic failure (28 report cases); zero skips, not timed out; #177 corrects the obsolete touch expectation |
| `xvfb-run --auto-servernum node tests/run-unified.mjs --sequence mobile --out test-artifacts/audit-20261023/final-mobile-traced` | Complete mobile/audit rerun including #177, one worker and zero retries | **PASS**, unchanged clean `bdf82cc`, exit 0, 258.703s: 27 passed, zero failed/skipped, no timeout or evidence errors |
| `TEST_URL=http://127.0.0.1:13127 QC_API_URL=http://127.0.0.1:14127/graphql xvfb-run --auto-servernum npx playwright test tests/perf/graph-perf.spec.ts --project=perf --headed --workers=1 --retries=0 --trace=on` | Owned placed graph, matching measured first/terminal samples, exact-data API samples and cleanup | **PASS**, `b009245`, exit 0: 3 passed in 33.9s, zero skips. `perf-final*` evidence; see dated performance lesson |
| `xvfb-run --auto-servernum node tests/run-unified.mjs --sequence perf-budgets --out test-artifacts/audit-20261023/final-perf` | Final local strict adapter execution of the same required performance selection | **PASS**, unchanged clean `e120df4`, exit 0, 31.533s: 3 passed, zero failed/skipped, no timeout or evidence errors |
| `xvfb-run --auto-servernum npx playwright test tests/e2e/graph/living-graph-effects.spec.ts --project=GraphDone-Core/dev-neo4j/chromium --headed --workers=1 --retries=0 --trace=retain-on-failure --reporter=json` | Additional CI living-graph selection; keep its evidence separate from performance budgets | **PASS**, clean `bdf82cc` before/after, exit 0, 53.761s: 3 passed, zero skipped/unexpected/flaky. `final-living.json`, `final-living-provenance.json`, `final-living.log` |
| `npm audit --omit=dev --audit-level=high --json` | Actual production high/critical threshold; severity counts do not establish reachability | **PASS for high/critical gate**, `b009245`, exit 0: zero high, zero critical, eight moderate. `final-production-audit.json`; residual full-tree/image scope remains open |
| Public CI on the final integration head | Required status checks, minimum-Node/Node 24 matrix and browser jobs; local passes do not substitute | **PENDING at this snapshot**. [PR #157 checks](https://github.com/GraphDone/GraphDone-Core/pull/157/checks) are authoritative for the final integration head after the documentation merge; an earlier-head run does not satisfy this row |
| Protected `dev` merge decision / resulting commit | Exact reviewed/tested head, required CI, human approval and remaining release blocks | **PENDING at this snapshot**. Record the final decision and resulting commit in [PR #157](https://github.com/GraphDone/GraphDone-Core/pull/157); scoped audit-branch merges above are not `dev` approval or deployment |

Browser commands require `TEST_URL=http://127.0.0.1:13127`, the matching owned
API/database and installed lockfile Chromium. Run browser selections serially;
new-user, mobile and performance pin one worker and zero retries. Smoke's
inherited retries do not make a retried outcome acceptable. Preserve each output directory rather than
overwrite earlier evidence. A later documentation-only commit must remain
distinguishable from the functional source that was tested.

The passing strict smoke and performance reports each recorded clean `e120df4`
at start and finish, with the same unchanged `5d8eb5cc…3f0636` source fingerprint
quoted for the new-user pass above. Their reports contain no evidence errors.
The standalone living-graph JSON does not embed Git provenance; its separate
provenance file records the command, exit status and clean `bdf82cc` checks
before and after execution. Do not conflate that attribution with the unified
runner's start/end source fingerprints.

Artifact origins are distinct. These audit-workstation paths are relative to
`.worktrees/`, not interchangeable directories:

| Evidence | Worktree and retained path |
| --- | --- |
| Original 36-pass/six-failure browser baseline | `core-validation-20261023/test-artifacts/audit-20261023/strict-new-user/` |
| Three-case measured performance pass | `core-perf-gate-20261023/test-artifacts/audit-20261023/perf-final*` |
| Other combined logs, JSON probes, audits and completed/running final browser reports named above | `core-final-candidate-20261023/test-artifacts/audit-20261023/` |

Before final approval, attach public review or durable sanitized evidence links;
a local path alone is not published evidence. Custom diagnostic redaction is
bounded, not general content sanitization. CI trace artifacts use disposable
test fixtures and follow the workflow's upload policy; the raw ZIPs can still
contain authenticated headers/bodies. Neither disposable fixtures nor #176's
safe file-copy boundary establishes that artifact contents are sanitized.

The one-off HTTP probe used two independently authenticated USER accounts and
owned folders/private graphs. It checked own-folder creation and own-graph
association, rejection of foreign graph association/folder mapping reads/folder
deletion, unchanged mapping after rejection, current stored demotion overriding
an older USER token, and synthetic-guest write rejection. These eight checks
exercise the actual HTTP/Neo4j/SQLite boundary. The `/tmp` script is not committed
or a CI-discovered test; keep its JSON and scope separate from repeatable folder
unit/schema regressions. It does not establish every generated resolver,
transport or deployed permission boundary.

The two image probes used API image
`sha256:af10a0b89522d0ab92a335fafa38d345d2beceeb32ea9440899706fbe4884aca`
and generic image
`sha256:96ddc59160c4682f8fd324041a60cc4c4482447332354524d2e1ee61af0aa0a2`.
Both connected to the owned Neo4j fixture and passed authentication/readback;
their optional MCP service remained offline. The positive-probe containers were
stopped afterward. These are local image startup checks, not deployed health or
complete multi-service acceptance.

The performance pass used four placed nodes/three edges and one real measured
tick per metric case, with a terminal matching-graph snapshot and unchanged
saved positions. A single pinned tick is not an FPS benchmark, a large-graph
capacity claim or evidence for unplaced layout performance.

## Acceptance mapping and release blocks

This is a mapping to evidence, not a PASS checklist. Unproven acceptance questions
remain **BLOCKED**, even if all Core merge gates eventually pass.

| New-user questions | Core evidence being validated | Remaining blocked release scope |
| --- | --- | --- |
| 1–6: entry, guest, account | Guest/admin UI and bounded password/magic-link/startup tests | Real remote email delivery/recovery, sign-out/session lifecycle and provider failures |
| 7–10, 12, 24–34: navigation and modes | Owned same-work fixture across modes, visible mobile controls, graph isolation and modal dismissal | Every control/filter/route/role combination; hosted backend parity |
| 11: browser history and direct routes | Some navigation/reload paths are exercised | **BLOCKED:** complete Back/Forward, bookmarked-route and direct-route reload journeys are not established |
| 13–23: useful work and recovery | Create/edit/grow/readback/reload, delayed-save drafts, scoped undo and layout retry | Multi-actor conflicts, forced-close/crash persistence, full connection/reverse/delete matrix |
| 35, 54–62: agents | Recorded contributions, explicit refresh and persisted visibility | Autonomous execution; complete agent-token purpose/scope/revocation and external-provider journeys |
| 36–41, 53: comfort and graph motion | Browser geometry/focus, actual drag/framing, measured graph snapshots | Native mobile keyboards, screen readers, live sign-in main landmark, device rotation/zoom combinations, large/unplaced graph performance |
| 42–43: states and display preferences | Selected loading, error and saved-state boundaries have tests | **BLOCKED:** complete loading/empty/error/offline/success/disabled-state acceptance and high-contrast/reduced-motion journeys are not established |
| 44–52: online release | Core localhost/schema/build evidence plus the separate live entry-page check | Exact Pages artifact/assets/API routing, hosted D1 mutation parity, headers/secrets, migrations/rollback and live multi-account journeys |

Security remains **BLOCKED for a comprehensive release-security claim**. The
reviewed folder/current-role, queue-owner, magic-link, password-accounting and
secret-startup fixes cover specific boundaries. Server-verified CAPTCHA policy,
login-versus-reset token purpose, broader session revocation and OAuth verified-email
linking remain open; remote provider flows were not exercised. In-memory password
budgets do not establish multi-replica enforcement. Residual dependencies and
untested permission/transport surfaces remain in the dated
[security scope](SECURITY_SCOPE_2026-10-23.md); its original findings are historical
and must be read alongside the follow-up PRs above.

Use [RELEASE_QC.md](RELEASE_QC.md), [RUNBOOK.md](RUNBOOK.md) and the full
[NEW_USER_GATE.md](NEW_USER_GATE.md) for later release evidence. No unchecked
question, unavailable provider, local note or unmerged PR counts as delivered
production validation.
