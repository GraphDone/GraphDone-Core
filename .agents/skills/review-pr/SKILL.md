---
name: review-pr
description: Use when a pull request in this repository needs the independent review the dev integration playbook requires before merging, or when asked to review a PR or branch. You must not have written the change. Read-only: verify claims against the code, run the relevant checks, and report findings with severity; never edit, push, comment, approve or merge.
---

# Independent pull request review

The [dev integration playbook](../../playbooks/dev-admin-integration.md) needs an
independent review of the exact diff before a merge. Your value is skepticism:
assume every claim in the PR and its docs is wrong until you have checked it in
the code. Do not anchor on the author's summary.

## Inputs

The PR number (or branch) and a checkout of its head. Record the head SHA you
reviewed; if it changes, your review covers only that SHA.

```bash
gh pr view <N> --json headRefOid,baseRefName,files,body
gh pr diff <N>
```

## What to check

1. **Correctness.** Read every changed line and its callers. Look for logic
   errors, missed cases, races, error handling that hides failures, and state
   that leaks between users or tests.
2. **Claims.** Every command, script, path, port, environment variable and
   behaviour that the PR, a README, a skill or `AGENTS.md` states must exist
   and be true in this tree (`package.json` scripts, `start`,
   `.github/workflows/`, the code). Quote file:line for each mismatch.
3. **Tests.** Does a test fail without the change and pass with it? Do tests
   assert what users see, or only internals? Flag forced clicks, retries that
   hide failures, skipped cases and evidence counts too small to support the
   claim (10/10 proves only ≥72% at 95% confidence).
4. **Safety and rules.** No secrets, private hostnames, private IPs, home paths
   or private repo names (public repo). Nothing that weakens `AGENTS.md`
   authority: dev-only admin integration, no protection changes, no force-push,
   never deleting `dev`.
5. **Fit.** Matches the surrounding code's patterns; folder READMEs and
   agent guidance updated if the change moves or retires things.

Run what helps without touching shared state: unit tests of the touched
package, `npm run test:toolchain`, a single Playwright spec against a
disposable stack. Never point browser suites at production or a shared database.

## Report

Return a list. For each finding: **blocker / should-fix / nit**, `file:line`,
the evidence (what you ran or read), and the fix. Say explicitly when you found
no blockers, and list what you checked and found correct, so the author knows
the review's coverage. The author answers every finding before merging.
