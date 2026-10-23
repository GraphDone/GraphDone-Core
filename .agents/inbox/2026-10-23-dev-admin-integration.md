# Owner-authorized admin integration still needs independent evidence and post-merge checks

Date: 2026-10-23. Searched `CLAUDE.md`, the symptom index and the existing
live-ref/transport lesson. Earlier audit notes recorded a non-author approval
blocker. The owner then explicitly authorized leaving `dev` administrator
enforcement disabled permanently, with a high testing bar for agent integration.
This changed the operating authorization; it did not create a non-author review.

The first integration used the native admin merge for
[PR #157](https://github.com/GraphDone/GraphDone-Core/pull/157); no SSH fallback
was needed. Read-only
verification on 2026-10-23 returned:

```text
gh pr view 157 --repo GraphDone/GraphDone-Core --json state,headRefOid,mergeCommit,mergedAt
state: MERGED
head: 385e7679fabc60b80cd65cf0a1aa4cdf3d592514
merge: 9068cd31824991330c6d92196654e53e04e29063
mergedAt: 2026-10-23T22:22:22Z

git ls-remote origin refs/heads/dev
9068cd31824991330c6d92196654e53e04e29063 refs/heads/dev
```

The merge parents are `8a7de052eb60fe517f45681dc42b5b169d09c660` and the frozen
`385e767` head. Its complete tree `6bf014bcc30eb6e21c0deeae4db9c7d4effeaac2`
equals that validated source. A read-only protection query confirmed
`enforce_admins: false`, configured approval count 1, and force pushes/deletions
disabled. The owner-directed exemption is not an approval record. Post-merge
CI was still running when this lesson was prepared; issue closure remains gated
on its actual result.

Corrective rule: use the [canonical dev integration playbook](../playbooks/dev-admin-integration.md),
freeze and independently review the diff, preserve failed/passing evidence,
verify source/base/result provenance and complete post-merge checks. Keep the
standing exception scoped to `dev`; do not toggle protection or change identity.
Historical pre-authorization notes remain historical evidence.

Limits: this authorization does not cover `main`, release or deployment actions,
force pushes, history rewriting, expanded credentials or any other protection
change. The documented docs-only exception requires exhaustive non-document
byte-equivalence proof and independent review; it does not excuse final CI.
