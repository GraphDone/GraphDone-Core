# Integrate into dev under the owner's standing admin authorization

The owner explicitly authorized this policy on **2026-10-23**: leave `dev`'s
administrator enforcement disabled permanently and allow agent-led admin
integration with the validation bar below. This is standing authority for
`dev`, not permission inferred from an admin role. It does not cover `main`,
releases, deployments, identity changes, broader credentials or other protection
changes. Do not re-enable the setting automatically or toggle it per merge.
Later explicit owner instructions supersede this policy.

## Before integration

1. Use an isolated worktree and a reviewable PR. Freeze the exact source head
   and read the live `dev` ref (`git ls-remote origin refs/heads/dev` or the Git
   ref API); PR `baseRefOid` is not proof of the live tip. Record both SHAs and
   the complete diff. If either changes, review the resulting composition and
   refresh the affected validation before merging.
2. Obtain independent agent review of the exact diff; resolve its findings.
   That review is useful evidence, **not a GitHub non-author approval**. The
   owner's standing authority permits the admin operation without claiming
   that a missing non-author approval was supplied.
3. Pass every applicable merge gate on the intended composition: pinned clean
   install, build, types, lint, unit/harness, production audit, and the relevant
   browser, disposable-database, runtime/image and installer checks. Runtime,
   dependency, workflow or test changes require the full relevant gates.
   Inspect actual job/step results; pending, missing, skipped required, flaky or
   timeout evidence is not a pass. Keep earlier failures and show the correction
   and subsequent evidence; do not make a retry stand in for a fix.
4. Record exact tested revisions, commands, results, review/check links,
   remaining limitations and owned-fixture cleanup in the PR. Follow
   [TEST_STRATEGY.md](../../docs/quality/TEST_STRATEGY.md). Passing Core gates does
   not establish hosted parity or release readiness.

## Documentation-only reuse

Runtime results may be reused only after independently reviewing the documents
and proving the complete change set is documentation-only. Record
`git diff --name-status <validated> <head>` and
`git diff --raw --abbrev=40 <validated> <head>`; inspect every changed path,
mode and blob against an explicit list of reviewed document paths. All other
tracked content must be byte-identical to the validated revision. A `.md`
extension or a partial path-filtered diff alone is insufficient. Any changed
runtime asset, dependency, workflow, script or test invalidates this exception.
Check links/formatting, retain the provenance proof and independently review
agent instructions as instructions. Final branch CI must still pass.

## Merge and verify

Prefer the native PR operation after the checks above:

```sh
gh pr merge <PR> --repo GraphDone/GraphDone-Core --merge --admin --match-head-commit <HEAD>
```

Recheck the live base immediately beforehand. If the API credential specifically
refuses a workflow update for missing `workflow` scope, an **already configured,
same-account SSH transport** may perform the already-authorized normal merge.
Record the exact refusal and identity check; authentication alone proves no
write permission. Never use this fallback to defeat a repository policy or
access denial; stop if that is the reason for refusal. Verify the local merge's source/base parents and complete
tree against the reviewed composition, then use an ordinary non-forced push.
A moved base requires renewed composition review, not force. Do not change
accounts, expand scopes, rewrite history or alter protection to make it work.

Verify the actual remote `dev` commit, ancestry and complete resulting tree;
do not rely only on a command's success or a PR badge. Unexpected parents or
content require renewed review and validation before closeout. Record the resulting
SHA and the administrative operation honestly. Remove only owned temporary
processes, fixtures and credentials while retaining sanitized evidence and
earlier failures. Wait for applicable **post-merge CI on the resulting branch
head** and inspect its results before closing the integration issue. A failure
keeps closeout open and requires a reviewed correction; never erase its evidence.

Background: [authorization and first verified integration](../inbox/2026-10-23-dev-admin-integration.md),
[live-ref and transport lessons](../inbox/2026-10-23-pr-base-ref-is-not-live-tip.md).
