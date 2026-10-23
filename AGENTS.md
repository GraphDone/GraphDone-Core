# GraphDone-Core agent instructions

Read [CLAUDE.md](CLAUDE.md) for project and testing conventions. Preserve other
agents' worktrees and use owned disposable fixtures for database/browser work.

The repository owner's standing authorization dated 2026-10-23 permits
administrative integration into **`dev` only** under the
[admin integration playbook](.agents/playbooks/dev-admin-integration.md).
`dev`'s “enforce rules for administrators” setting is intentionally disabled
permanently; do not automatically restore it or toggle protection for a merge.
Leave every other protection unchanged. Main, releases and deployments are
outside this authorization.

Prefer a reviewable PR and an exact-head admin merge. Require independent agent
review, the playbook's validation/provenance checks and final branch CI. Admin
authority is not a non-author approval; report which operation actually occurred.
Do not expand credentials, change identity, force-push or rewrite history.

Search the [symptom index](.agents/issues/INDEX.md) and existing lessons before
adding guidance. Record new incidents in `.agents/inbox/YYYY-MM-DD-<lesson>.md`
with dated evidence, cause, corrective rule and limits; link the relevant index.
Keep durable procedures in `.agents/playbooks/` and carry notes with the fix
through review. Local notes alone are not published knowledge.
