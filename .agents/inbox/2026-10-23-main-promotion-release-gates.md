# A validated dev tree does not validate main-only publication or persistence

Date: 2026-10-23. Searched the symptom index, the dev admin-integration
playbook, and the validation ledger before inspecting main promotion.
The owner requested a clean, quota-conscious finish and promotion of good work
to main. Dev validation is complete; the remaining release work is tracked in
[issue #189](https://github.com/GraphDone/GraphDone-Core/issues/189).

Dated composition evidence:

```text
main: 775362eace0723c57b7ba3c7936645c9d0d36cb4
validated dev: ef495eff15ed7aac51e72dc7a1db1bb96d2b3695
local normal merge: 88ce10dc8c39b1687c180ff22db20744c4bf2996
merge parents: main775362ea + dev ef495eff
merge conflicts: none
merge tree: 6bdd9d820f98b9882c3dcf6a110badd88bfe78bc
all 683 tracked entries equal validated dev, including modes/types/blob IDs
```

The two main-only commits were merge wrappers whose trees equal their source
parents. Independent review confirmed the candidate's complete composition,
not its release readiness. The two documentation paths added by this handoff
are separate from that original byte-identical candidate; no runtime code was
changed for the checkpoint.

Read-only source findings at `ef495eff`:

- `.github/workflows/docker-publish.yml` runs even for main-target PRs and sets
  `push: true` before validation; main publication can move `latest`.
- Main-only production smoke has no matching generated admin credential, weak
  HTTP readiness and retry-tolerant raw smoke; `CI Success` omits that job.
- Compose mounts SQLite at `/app/data`, while the API workspace resolves its
  database under `/app/packages/server/data`; recreation persistence needs an
  owned-container negative/positive test.
- Deploy uses a missing root Dockerfile, unpinned CI-completion checkout and
  echo/TODO deployment steps. A successful message is not a deployment.

Cause: development browser/API validation does not exercise the different
production Compose paths, registry event conditions or deployment actions.
A mergeable tree can therefore still have release blockers.

Corrective rule: inspect event side effects before opening the promotion PR;
make PR builds nonpublishing, pin publication to validated source, repair the
owned production fixture/readiness/result propagation, and verify SQLite
persistence through container recreation. Run one deliberate production-stack
gate after the focused correction. Preserve the existing main protections
unless the owner explicitly authorizes a different admin policy. The standing
dev exemption does not silently extend to main.

Resume in the order and acceptance criteria in issue #189. Do not open a main
PR while its existing hook still publishes to GHCR. Keep the reviewed source
and this handoff committed; do not force-push or rewrite either history.

Limits: these are source findings, not newly executed production failures.
No production-stack run, registry publication, deployment or main protection
change was performed for this review. No runtime resources were started.
