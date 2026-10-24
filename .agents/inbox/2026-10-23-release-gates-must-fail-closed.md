# A passing aggregate must include every selected production gate

Date: 2026-10-23 UTC. Scope: GraphDone-Core main promotion, issue #189.

## Evidence

At dev `ef495eff15ed7aac51e72dc7a1db1bb96d2b3695`, the CI Success job
omitted prod-smoke from both dependencies and result checks. Docker Publish ran
on main PRs and pushes with `push: true` before CI. Deploy and Release contained
placeholder deployment steps that could report success without deployment.

Command: `node --test tests/lib/release/workflows.test.mjs`.
The regression applied to the baseline produced 22 tests: 8 passed, 14 failed.
After correcting the workflows the same cases produced 22 passed, 0 failed.
The test executes the aggregate shell under selected/nonselected production
outcomes and checks the publication/deployment boundary. Original local logs:
`/tmp/graphdone-release-gates-before.log` and
`/tmp/graphdone-release-gates-after.log`; the regression is tracked with the fix.

## Cause and corrective rule

A success badge only represents jobs explicitly required by its aggregate.
Require the production job when selected, and permit skipped only when it was
not selected. Main PRs need the gate before merge as well as final main CI.

Keep build validation read-only until an exact-SHA release process has been
implemented and validated. An unfinished deployment must fail explicitly, not
claim success. Main source promotion is not publication or a live-site rollout.
See [release gates](../../docs/quality/RELEASE_GATES.md).

## Limits

Workflow tests establish event/result/write guards, not production runtime
correctness. The real isolated production-stack and persistence checks remain
required. Registry publication and deployment are intentionally disabled;
implementing them is a separately tracked release task. Main protection is
unchanged by these source edits; the dev admin exception does not extend it.
