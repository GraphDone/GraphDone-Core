# A GitHub connector denial describes that client, not every configured client

Date: 2026-10-27. Context: publishing the owner-authorized GraphDone LOD work as
a draft PR to `dev`. Searched the symptom index and the existing live-ref/transport
lesson before recording this distinct create-PR case.

## Evidence

The feature branch push succeeded through the existing SSH remote. The GitHub
connector's `create_pull_request` then returned:

```text
HTTP 403: Resource not accessible by integration
```

The existing CLI returned `mvalancy` for `gh api user --jq .login` and successfully
ran `gh pr create --repo GraphDone/GraphDone-Core --base dev --head
feature/dynamic-lod-overview-20261027 --draft --body-file <owned file>`.
Readback confirmed [PR #192](https://github.com/GraphDone/GraphDone-Core/pull/192)
was open, draft, and pointed at the intended source head. No authentication,
account, token scope or repository protection was changed. No merge occurred.

## Cause and corrective rule

The integration could read this repository but could not create the PR. Its
permission boundary differs from the already configured CLI credential. Report
that specific limitation rather than declaring all GitHub access blocked or
requesting broader credentials. For an already-authorized operation, an existing
client with its own valid access can be used; verify the resulting object and
source head. Do not use another client to evade repository policy, an account
denial, an approval rejection or an operation outside the user's authorization.

## Limits

This establishes one successful draft-PR creation through existing credentials.
It does not establish write access for other repositories, non-author approval,
merge readiness or deployment authority. The narrower admin-integration playbook
still governs merges; this incident does not amend that policy.
