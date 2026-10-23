# Distinguish the static loading shell from a mounted application and retain failure traces

Date: 2026-10-23. Searched `tests/e2e/quality/button-content.spec.ts`, the unified
manifest/adapter, Playwright configuration, prior responsive acceptance lessons,
`packages/web/index.html`, and `App.tsx`. Public tracking: #156.

The strict combined acceptance run on frozen
`f8a11e16a593738d485547eb1dfe117438cc3ed6` reported this failure before button
inspection on one route/viewport iteration:

```text
Locator: locator('main')
Timeout: 5000ms
Error: element(s) not found
Snapshot: GraphDone Logo / GraphDone Loading...
```

The screenshot and DOM snapshot exactly match the static HTML shell in
`packages/web/index.html`: Loading text and empty placeholder cards. React's
authenticated initialization screen instead says Initializing and includes
feature text; route Suspense appears inside Layout's main element. Thus this
failure establishes that the mounted application was unavailable at the
deadline, not that a button label was clipped. It does not by itself distinguish
delayed module loading/execution from a startup error.

The screenshot timestamp was 12:53:58 America/Los_Angeles. Docker build/export
work overlapped the run and the generic image build log completed at 12:55:38.
Resource contention is a hypothesis, not a proven cause. The original artifact
did not identify the current route or exact viewport; its 375-by-1144 full-page
PNG dimensions do not establish the viewport. No trace existed because the
global setting was on-first-retry while the strict sequence used zero retries.
Artifacts remain in the candidate worktree's ignored
`test-artifacts/playwright-output/quality-button-content-*/` directory and must
be preserved before another run.

Corrective rule: keep zero retries and existing deadlines, but record
retain-on-failure traces for required browser sequences. Label every route and
viewport iteration and attach bounded browser errors when the sweep fails.
Copy trace/diagnostic files into the retained unified report before another
Playwright process can clear its shared output directory. Do not equate the
absence of API errors with successful frontend startup.

Evidence-only correction on public PR175 base `1a16d4e`: three new controlled
child-process tests first failed because the actual Playwright command lacked
failure-only tracing. A fourth failed because the adapter dropped trace and JSON
attachments. After correction, Node 22.23.4 `npm run test:unified:lib` passed
156/156 with zero skips, including bounded event capture, credential/URL
sanitization, listener cleanup, and file retention after deleting the original
Playwright output. Playwright `--list` still collected the single unchanged
button sweep. Logs: `/tmp/core-browser-diagnostics-{red,retention-red,final}.log`.

Limits: these checks validate evidence collection and command forwarding, not
the underlying startup failure or deployed health. No browser was launched and
no application code, deadline, retry policy, or assertion threshold changed in
this correction. A serialized complete acceptance rerun is still required;
retain the earlier failed run and distinguish observations from causal claims.
