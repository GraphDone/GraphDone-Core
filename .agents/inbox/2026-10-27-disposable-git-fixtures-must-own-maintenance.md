# Disposable Git fixtures must prevent detached maintenance before cleanup

Date: 2026-10-27.

## Evidence

Comprehensive run [40589229879](https://github.com/GraphDone/GraphDone-Core/actions/runs/40589229879)
on OAuth head `809f17f1301a1354148d2b25114437301dc4f06f` failed its
Node 22.18 harness. Two invalid CLI selection cases completed their assertions,
then `t.after` reported `ENOTEMPTY` removing `.git` and `.git/objects`.
The runner used Git 2.55.0. These invalid options exit before source provenance
collection, whose Git calls are synchronous anyway.

An independent owned Git 2.55 probe recorded 12/12 fixture commits starting
`git maintenance run --auto --quiet --detach`. Ten traces recorded descendant
activity after the commit parent exit. Repository-local `maintenance.auto=false`
prevented all 12 launches. Strict local removal passed both variants; the exact
CI cleanup error was not reproduced. Temporary probe evidence is at
`/tmp/graphdone-review-git255-mofpt0da/trace-summary.json` on the investigating
host, not a portable or published artifact.

The committed regression captures `GIT_TRACE2_EVENT` from the real fixture
commit into its ignored `bin/` directory and rejects maintenance child launches.
On local Git 2.43 / Node 22.18, running
`node --test --test-name-pattern='disposable Git fixture' tests/lib/runner/unified-cli.test.mjs`
failed against the old setup because a maintenance child was recorded.

## Cause and corrective rule

A synchronous Git parent does not guarantee all its descendants have exited.
Newer Git versions can detach automatic maintenance before the fixture owner
removes its repository. This is a confirmed lifetime hazard and the strongest
explanation of the CI error, not proof of which exact file the CI writer made.
See the [Git maintenance contract](https://git-scm.com/docs/git-maintenance).

Immediately after initializing a disposable fixture, configure repository-local
`maintenance.auto=false` and `gc.auto=0` before adding or committing files.
Keep strict cleanup, failure propagation, and provenance checks. Do not add
cleanup retries to conceal a live writer or alter global/developer repository
configuration. Observe the actual child process behavior in the regression.

## Limits

This applies only to repositories owned by the test fixture. It neither
suppresses external processes nor certifies arbitrary inherited Git hooks.
No application runtime, OAuth behavior, or production Git configuration changes.
Final supported-Node CI remains required before integration.

## Corrected validation

The complete CLI suite passed 28/28 on local Git 2.43 and on the owned Git
2.55 build. A pinned clean install followed by `npm run test:unified:lib`
passed 175/175, with no skips, cancellations or retries. Both invalid-option
assertions and strict cleanup remain intact. The correction is isolated to
fixture initialization plus its real-process regression and this guidance.
