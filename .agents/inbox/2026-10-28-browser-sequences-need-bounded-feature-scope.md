# Growing acceptance coverage needs bounded feature sequences

Date: 2026-10-28. Searched the symptom index, cold-fixture budget and browser
file-evidence lessons before changing the PR226 harness enrollment.

## Evidence and cause

`gh run view 40780316041 --repo GraphDone/GraphDone-Core --log-failed`
reported `failed — 0✓ 1✗ 0⚠ 0⏭ (901.0s)` for the new-user sequence onbcf3946.
The actual strict report has exitCode:null, timedOut:true, no valid Playwright
JSON, and only the synthetic execution-evidence failure. Earlier completed
new-user durations were662.050s on the accepted224 checkpoint and709.295s on3ec,
whose actual desktop control overflow was independently fixed inbcf.

The retained smoke-layout trace began at885.829s process time. The outer runner
killed it at899.782s, about14s into its60s test, during an existing wait. Its
closed-page/channel errors followed shutdown. This is an aggregate900s runner
limit, not proof that the layout interaction independently timed out. No retry
or green predecessor can turn this incomplete run into acceptance.

Eight raw inspector PNGs and two receipts survived and were inspected: both
widths recorded zero mode overflow,96px title bounds and no writes/page errors.
They are not completed-case evidence because the final Playwright report is
missing. The receipts contain no elapsed timestamps, and extracted file mtimes
are download times; do not invent an inspector duration from them. Downstream
semantic/nested/recovery/routes/mobile/living/performance stages did not run.

## Corrective rule and regression

Keep the original42-case new-user membership intact and move the new two-case
inspector feature into its own blocking `inspector-readability` sequence. Enroll
it explicitly in the serial CI Smoke Gate and both pr/full profiles. Preserve
every browser assertion, all per-test and adapter timeout values, one headed
worker, zero retries, failure tracing and strict owned-fixture cleanup. A feature
sequence has its own complete report and attachments; a missing report still fails.

The CLI regression verifies separate enrollment, exact inspector spec membership,
headed single-worker execution, no retries and failure-only tracing. A deliberate
failed Playwright result must fail this sequence and retain its trace and JSON
even after the original output directory is removed. The original new-user
sequence retains the same negative control. This is harness isolation, not a
renderer performance improvement or reduced acceptance coverage.

Both new sequences and the entire final CI composition must pass with valid
reports before integration. Runtime and inspector source bytes are unchanged
by this correction; hosted validation remains required for the workflow change.

Local validation on2026-10-28: Node22 serial CLI and execution-evidence suites
passed75/75 in10.47s, with zero skips. An executable comparison against accepted
dev showed every original sequence definition and profile membership unchanged;
only inspector-readability was added. `git diff --check` passed. These harness
controls do not substitute for the fresh hosted browser reports.
