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

## Repository map

| Path | What goes there |
| --- | --- |
| `packages/` | npm workspaces: `core`, `server`, `web`, `mcp-server`. Product code and its unit tests. |
| `tests/` | Cross-package suites, Playwright specs and the unified harness ([map](tests/README.md)). Single-purpose Playwright configs sit beside their specs. |
| `docs/` | Human documentation ([index](docs/README.md)). |
| `scripts/` | Runnable shell/Node scripts: stack lifecycle, VM, installer, certificates ([map](scripts/README.md)). |
| `deployment/` | Dockerfiles and compose stacks ([map](deployment/README.md)). |
| `.agents/` | Agent knowledge: incident lessons (`inbox/`), symptom indexes (`issues/`), playbooks ([map](.agents/README.md)). |
| `.github/`, `.githooks/` | CI workflows and PR template ([map](.github/README.md)); local git hooks ([map](.githooks/README.md)). |
| `README.md`, `AGENTS.md`, `CLAUDE.md`, `LICENSE` | The only root docs: overview, agent rules, project and testing conventions, licence. |
| `start`, `Makefile` | The one-command launcher and its make shortcuts. |
| root config | `package.json`, lockfile, `turbo.json`, `tsconfig.json`, `playwright.config.ts`, lint/format/ignore files, `.env*.example`. Only what a tool must find at the root. |

Root entries are allowlisted in `tests/toolchain/repo-root-contract.mjs` (CI
"Repository root allowlist"). The list may only shrink: put a new file in the
folder above, never at the root. Inside a folder, split into domain-named
subfolders only once it is cluttered (about 15–20 files, or two or more topics
with three or more files each); give each new subfolder a short `README.md`
map linked from its parent, and move files with `git mv`. Retired files are
deleted, not parked; git history keeps them.

## Contributor tiers

- **Maintainer agents** act under the owner's standing authority above: claim
  work, open PRs, get independent review, and integrate into `dev` per the playbook.
- **Trusted collaborators** work through gated PRs: required checks and review
  apply, and they never merge their own PRs.
- **Outside forks** are evidence, not trusted code. Never approve fork workflow
  runs; bring good changes in by cherry-pick (keeping the author) after a
  line-by-line security review.
