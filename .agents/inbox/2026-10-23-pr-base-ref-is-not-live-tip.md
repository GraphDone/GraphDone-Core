# Verify live refs and transport authority before accepting a merge

Date: 2026-10-23. Searched `.agents/` and `docs/quality/` for `baseRefOid`,
`ls-remote`, Git ref APIs, branch-tip and merge-inventory guidance. No existing
lesson described this mismatch.

At 20:40 UTC, the read-only merge inventory observed these responses. A separate
read-only recheck during the same audit returned the same values:

```text
gh pr view 158 --json number,baseRefName,baseRefOid
number: 158
baseRefName: audit/core-validation-20261023
baseRefOid: a6d2d4138daf31fb07d8727fc33779a9bfdb1404

gh pr view 160 --json number,baseRefName,baseRefOid
number: 160
baseRefName: audit/core-validation-20261023
baseRefOid: a6d2d4138daf31fb07d8727fc33779a9bfdb1404

gh pr view 161 --json number,baseRefName,baseRefOid
number: 161
baseRefName: audit/core-validation-20261023
baseRefOid: 100625e58a01d282082e9d1fd74d61020f01f842

git ls-remote origin refs/heads/audit/core-validation-20261023
100625e58a01d282082e9d1fd74d61020f01f842 refs/heads/audit/core-validation-20261023

gh api repos/GraphDone/GraphDone-Core/git/ref/heads/audit/core-validation-20261023
ref: refs/heads/audit/core-validation-20261023
object.type: commit
object.sha: 100625e58a01d282082e9d1fd74d61020f01f842
```

The inventory stopped at the mismatch; no branch mutation occurred during this
check. The workflow assumption was the problem: it used a PR's `baseRefOid` as
proof of the live target-branch tip. The observed PR responses did not agree
with one another, while the Git remote ref and GitHub Git-ref API agreed.

Corrective rule: resolve the named target branch through its actual Git ref
before composing or merging reviewed heads. Record that tip and the exact PR
heads, stop if independent ref reads disagree, and verify the resulting merge
head and tree against the reviewed composition. Do not substitute a PR's
`baseRefOid` for the live branch ref or assume a successful merge command proves
the expected content.

Limits: these are the responses observed in this audit. They do not establish
why the API values differed, a GitHub defect, or that every PR response is stale.
A ref can change after a read, so a later merge still needs its own resulting
head/tree verification. No remote-metadata mocking test was added; it would not
prove the state of the actual public branch.

## A workflow-scoped API refusal needs its own evidence

Later on 2026-10-23, the merge helper attempted the exact reviewed PR #170 head:

```text
gh pr merge 170 --repo GraphDone/GraphDone-Core --merge --match-head-commit bc483d21d74e787d7807a909757fb2538e0cea14

GraphQL: refusing to allow an OAuth App to create or update workflow `.github/workflows/ci.yml` without `workflow` scope (mergePullRequest)
```

The helper `/tmp/graphdone-audit-merge.py` raised `RuntimeError` and stopped. This
response establishes a refusal for that OAuth merge operation, not completion
of the merge. No permission expansion or account switch occurred.

The existing remote was `git@github.com:GraphDone/GraphDone-Core.git`. A read-only
identity check of the already configured SSH credential returned:

```text
ssh -o BatchMode=yes -T git@github.com
Hi mvalancy! You've successfully authenticated, but GitHub does not provide shell access.
exit: 1
```

That is GitHub's successful identity-only response; it does not prove branch
write authorization. It identified the same `mvalancy` account already used for
the audit. A normal local merge and SSH push to the audit branch was being
reviewed; no such push or merge completion is claimed by this observation.

Corrective rule: retain the exact rejected operation and stop that attempt.
Before considering an existing alternate transport within the already
authorized task, verify its account and the live refs; do not infer new
permissions from authentication. Any eventual normal merge/push still needs
the expected resulting head/tree, remote-ref verification, and final CI/review.
The protected `dev` branch and its approval requirements remain unchanged.

Limits: the observed error names the missing OAuth scope, but this record does
not establish all token or branch permissions. It is not evidence of a pushed
merge or a reason to broaden permissions, change accounts, force-push, or
disable branch protection.

Confirmed follow-up, 2026-10-23: ordinary same-account SSH merge pushes completed
[#170 at `dcbd5e2`](https://github.com/GraphDone/GraphDone-Core/commit/dcbd5e29ae68e90788855d86b15455b2374fdbd6),
[#174 at `5f834b1`](https://github.com/GraphDone/GraphDone-Core/commit/5f834b1947face3b281093a00a1a29e18ab135c2)
and final audit integration
[#161 at `84f1c0d`](https://github.com/GraphDone/GraphDone-Core/commit/84f1c0d132a6fda6a6bc13270363cf18b69a89f0).
The remote audit ref and GitHub merged state were verified. The entire final
tree `f5a394d442193a502ffa144022fcdcfeb8889f90` equals tested candidate
`bdf82ccdd79bbc4c21ce4833023f78596a1be4a8`. These later records establish the
audit-branch outcome; the earlier SSH identity response alone did not. Final
public integration CI and protected `dev` approval remain separate requirements.
