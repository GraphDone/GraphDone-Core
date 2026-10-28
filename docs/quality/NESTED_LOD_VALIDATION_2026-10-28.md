# Nested semantic LOD validation — 2026-10-28

Issue #215 continues the [delivery plan](../architecture/dynamic-graph-lod.md#9-nested-hierarchy-continuation-2026-10-28-215).
This ledger describes the candidate before final independent review and CI;
exact accepted revisions and final results belong in the implementation PR.

## Source and environment

The candidate starts at `53c124c39fd0e8495f26e27a981ad06557805878`, whose full tree
`fe1a54bc68148a2c5955c0d350784218c348d5f6` equals native dev merge
`77899e98a081e725ae8ddc15b6566cc50c9a584f`. It includes #213 layout recovery and
#214 self-host maintenance. Node 22.18.0/npm 10.8.2 clean install and Core build
succeeded. Owned Vite port 28928 uses the stable built API on 28817 and disposable
Neo4j 5.26.12 on bolt 28687. Original localhost 8540 and CodeGraph remain untouched.

Browser coverage uses installed Chromium, one worker, zero retries, a desktop
1440×900 viewport and a 390×900 viewport with actual CDP touch events. This is
phone emulation, not physical-device acceptance. Fixtures register owned IDs
before setup completes and delete edges before nodes; teardown errors fail tests.

## Failing-before and preliminary evidence

On 2026-10-28, two new hierarchy assertions failed against the previous projection
(wrapper ignored the requested cut): explicit nested/direct membership and nested
native containment. The candidate passed those assertions and then all 18 model
cases, including unique coverage at every cut for 200 items/503 relationships,
reordered input, source object identity, cycles, parallel/opposite/self links,
missing endpoints, 2,000-deep native containment, 100-segment explicit paths,
invalid metadata, deterministic IDs, hysteresis and label-budget parent fallback.

The new desktop journey also ran against the unchanged `168b984` web source on
28818. It failed at the missing `Show 2 subgroups` control with the existing 10s
action timeout, after authenticating and opening the real group browser. Trace
and screenshot were retained; the owned fixture was cleaned. This is an expected
negative control, not an accepted test run.

The prototype's first desktop/phone run passed 2/2 in 2.3 minutes, using 72 pinned
items and 111 typed relationships with three-level paths, direct parent items,
cross-system cycles, parallel edges and a long member title. It checked expansion,
ancestor collapse, source inspection, exact return camera, actual pan and desktop
wheel input, unchanged label slots, exact source readback and zero attempted
mutations/page errors. Later assertions add explicit selected-parent accessibility
and repeated zoom-threshold crossings; they require fresh validation.

Retained local evidence is under `/tmp/graphdone-resolution-20261027/`:
`nested-lod-negative.log`, `nested-lod-old-negative.log`,
`nested-lod-old-negative-artifacts/`, `nested-lod-budget-model.log`,
`nested-lod-first-browser.log` and `nested-lod-first-artifacts/`.
The strict `nested-lod` sequence is enrolled in PR/full profiles and the CI Smoke
Gate, with zero retries and retained failure traces. CLI tests verify enrollment.

## Review corrections

Initial frozen candidate `43ada01` passed strict nested 2/2 in 86.5s with clean
matching source fingerprints; full unit coverage 750 passed plus 26 existing
DB-gated skips, 194 harness cases, types, lint and build also passed. Independent
review nonetheless found two P2s: Auto Back lost the entry hysteresis history,
and automatic replacement of a focused summary left focus on the document body.
The independent randomized model probe passed 1,200 fixtures / 6,000 cuts; these
UI findings demonstrate why pure conservation is insufficient.

Four new component regressions failed before correction (depth return, visibility
return, focused expansion/collapse, live removal); the unrelated-focus control
passed. The actual desktop browser restored the exact camera but failed the old
root-group count after Auto Back. Both negatives and their traces are retained.
The correction saves/restores both Auto state machines and reconciles only lost
owned summary focus to a surviving member representative or the group list.
Focused corrected component/model tests passed 23/23, and types passed. See the
[canonical lesson](../../.agents/inbox/2026-10-28-lod-return-needs-hysteresis-and-focus.md).
The initial source's green checks do not validate this correction; fresh frozen
browser, full checks and renewed independent review are required.

## Retained validation failures after review correction

Corrected frozen `1baac30` passed strict nested 2/2 in 103.0s and renewed
independent review/probes. A concurrent full-coverage run exceeded the existing
5s limit in the new 40-member component fixture (392 other web cases passed).
The component test needs only a parent and two nonempty children, so it now uses
four members with the same five assertions. In an isolated clean-installed
worktree, the reduced fixture still failed all four intended assertions against
43ada01 and passed all five against the corrected component with coverage. The
first attempted isolated run failed before test execution because a symlinked
install could not resolve the nested Vite plugin; that startup error is retained
separately and is not counted as the executed negative.

The existing 301/370 desktop browser journey also exceeded its unchanged 120s
interaction budget during the concurrent coverage workload; the phone case
passed. Its trace shows generally slow actions and clock advancement (one150ms
clock advance took6.98s), rather than an assertion for changed semantic behavior.
Source fingerprints remained clean/identical, and owned teardown completed.
This run is rejected, not retried into a pass. Final local validation serializes
CPU-heavy coverage and browser gates to remove this observed interference.
No 72-item/301-item browser fixture, assertion, timeout or retry policy is reduced.
If serial acceptance still fails, it remains a blocker requiring investigation.

Evidence: `nested-1baac30-coverage.log`, `nested-existing-lod-1baac30/`,
`nested-small-fixture-negative.log` (startup failure),
`nested-small-fixture-executed-negative.log` (four intended failures) and
`nested-small-fixture-positive.log` (five passes with coverage), all under the
retained evidence directory above.

## Acceptance still required at the frozen candidate

Run strict nested, existing 301/370 semantic LOD, layout recovery and smoke browser
sequences; existing mobile/new-user/performance gates; full unit/harness, build,
types, lint, audit, runtime images, real database contracts and installer gates.
Obtain independent exact-source review and inspect actual uploaded CI reports.
A passing prototype does not substitute for these gates or final dev CI.

## Capability limits

This adds nested display hierarchy and a screen-slot budget, not per-region
spatial virtualization or summary-first loading. All source SVGs/data remain
loaded. No 1k/10k capacity, hosted parity, topology clustering, production
publication or deployment is claimed. Existing source relationships and layout
recovery remain authoritative; summaries cannot be persisted as WorkItems.
