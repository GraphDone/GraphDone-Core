# GraphDone-Core agent instructions

The one instruction file for every agent harness. Claude Code loads it through
`CLAUDE.md` (`@AGENTS.md`); Codex and others read it directly. GraphDone is a
graph-native work tool: people and AI agents coordinate through items,
dependencies and outcomes. This repository is the open-source Core; the hosted
site graphdone.com is built from it elsewhere. It is public: never commit
private hostnames, IPs, home paths, private repo names or secrets.

## Authority

This section and [Contributor tiers](#contributor-tiers) change only on the
owner's explicit instruction; agents improving guidance must not edit them.

The repository owner's standing authorization dated 2026-10-23 permits
administrative integration into **`dev` only** under the
[admin integration playbook](.agents/playbooks/dev-admin-integration.md).
`dev`'s “enforce rules for administrators” setting is intentionally disabled
permanently; do not automatically restore it or toggle protection for a merge.
Leave every other protection unchanged. Main, releases and deployments are
outside this authorization (the [`release-core`](.agents/skills/release-core/SKILL.md)
skill is for when the owner asks).

Prefer a reviewable PR and an exact-head admin merge. Require independent agent
review, the playbook's validation/provenance checks and final branch CI. Admin
authority is not a non-author approval; report which operation actually occurred.
Do not expand credentials, change identity, force-push or rewrite history.
Preserve other agents' worktrees; use owned, disposable fixtures for database
and browser work.

## Before you change anything

1. Find the folder in the [repository map](#repository-map) and read its
   `README.md`; every folder has one.
2. Search the [symptom index](.agents/issues/INDEX.md) and lessons for what you
   are touching, and check the [skills](#skills) for a matching task.
3. Mimic the surrounding code: its libraries, patterns and naming. Never assume
   a library is available; check that the package already uses it. Do not add
   code comments unless asked.
4. Branch from `dev`, open the PR into `dev`. Never delete `dev` or use
   `--delete-branch` on a release merge. Product work starts from a story in
   [`docs/USER_STORIES.md`](docs/USER_STORIES.md) or a GitHub issue, with its
   test written first.

## Run, build, test

```bash
./start dev                       # first run writes packages/{server,web}/.env, starts Neo4j, web :3127, API :4127
./start stop                      # stop it (./start remove also deletes containers and volumes)
npm run db:seed                   # sample work items; Neo4j browser on :7474 (neo4j / graphdone_password)
npm run build && npm run typecheck && npm run lint
npm test                          # package unit tests only (Turbo); no browser
TEST_URL=http://localhost:3127 npm run test:smoke        # THE GATE, see below
TEST_URL=http://localhost:3127 npm run test:unified:smoke
npm run test:toolchain            # every tests/toolchain/*-contract.mjs (root, content, versions, READMEs, .agents, ...)
```

**THE GATE:** before claiming anything works, run `npm run test:smoke` against
a disposable stack. It sees the app as a user does: login, nodes and edges
render, no error chrome, no GraphQL or JS errors, the grow flow works, no
orphan edges. Green unit tests do not mean the app works. Browser suites
create and delete data: never point them at production or a shared database
(the guest journeys in [`run-journeys`](.agents/skills/run-journeys/SKILL.md)
are the exception: their work stays in the throwaway browser). Never fake a
test, force-click past a failure or retry until green; report skipped, flaky
and untested behaviour. Test guide: [`docs/testing/`](docs/testing/README.md).

## Gotchas

- Delete a work item's edges before the item: orphan edges break the whole
  edges query.
- After an Apollo mutation, refetch by operation name (`refetchQueries:
  ['GetWorkItems', 'GetEdges']`) so every open list updates, not only the
  query you passed.
- The web app calls `/api/graphql`; Vite (dev) and nginx (production) map it.
- The server reads `packages/server/.env`, not the root `.env`; a bare
  `npm run dev` needs `./start setup` first and a running Neo4j. Neo4j's first
  boot downloads plugins and can take minutes; meanwhile the server runs in an
  auth-only mode.
- `packages/mcp-server` tests run one file at a time on purpose (chaos suites
  exhaust file descriptors and CPU).
- Overlays render with `createPortal(..., document.body)` and register with
  `useDialog`: one exclusive dialog at a time, Escape closes the top one; see
  the [web UI guide](docs/guides/web-ui-architecture.md#ui-conventions).
- Version numbers: `scripts/update-version-minimal.sh <version>`; the version
  contract fails CI if a copy is missed.

## Skills

Procedures for recurring tasks live in [`.agents/skills/`](.agents/skills/README.md)
(Claude Code also lists them via `.claude/skills`). Before a matching task, read
its `SKILL.md` and follow it.

| Skill | Use when |
| --- | --- |
| [`improve-agents-folder`](.agents/skills/improve-agents-folder/SKILL.md) | Adding, changing or retiring agent guidance, or guidance misled you |
| [`folder-readme`](.agents/skills/folder-readme/SKILL.md) | Creating or changing a folder, or a README is missing or stale |
| [`run-journeys`](.agents/skills/run-journeys/SKILL.md) | Measuring how reliably basic tasks work per path and device |
| [`release-core`](.agents/skills/release-core/SKILL.md) | The owner has asked for a Core release |

## Writing things down

Record new incidents in `.agents/inbox/YYYY-MM-DD-<rule>.md` with dated
evidence, cause, corrective rule and limits, and link them from an
[index](.agents/issues/INDEX.md). Keep guidance small and current: improve
existing entries before adding, turn rules into tests where a program can check
them, and delete what is stale or duplicated in the same PR. The rules and
their checks: [`.agents/README.md`](.agents/README.md). Status, plans and TODOs
go in GitHub issues, never in the tree. Local notes alone are not published
knowledge.

## Repository map

| Path | What goes there |
| --- | --- |
| `packages/` | npm workspaces: `core`, `server`, `web`, `mcp-server`. Product code and its unit tests ([map](packages/README.md)). |
| `tests/` | Cross-package suites, Playwright specs and the unified harness ([map](tests/README.md)). Single-purpose Playwright configs sit beside their specs. |
| `docs/` | Human documentation ([index](docs/README.md)). |
| `scripts/` | Runnable shell/Node scripts: stack lifecycle, VM, installer, certificates ([map](scripts/README.md)). |
| `deployment/` | Dockerfiles and compose stacks ([map](deployment/README.md)). |
| `.agents/` | Agent guidance: skills, playbooks, lessons (`inbox/`), symptom indexes (`issues/`) ([map](.agents/README.md)). |
| `.claude/` | Claude Code project settings; `skills` links to `.agents/skills` ([map](.claude/README.md)). |
| `.github/`, `.githooks/` | CI workflows and PR template ([map](.github/README.md)); local git hooks ([map](.githooks/README.md)). |
| `README.md`, `AGENTS.md`, `CLAUDE.md`, `LICENSE` | The only root docs: overview, agent instructions, the Claude Code import of this file, licence. |
| `start`, `Makefile` | The one-command launcher and its make shortcuts. |
| root config | `package.json`, lockfile, `turbo.json`, `tsconfig.json`, `playwright.config.ts`, lint/format/ignore files, `.env*.example`. Only what a tool must find at the root. |

Root entries are allowlisted in `tests/toolchain/repo-root-contract.mjs` (CI
"Repository root allowlist"). The list may only shrink: put a new file in the
folder above, never at the root. Inside a folder, split into domain-named
subfolders only once it is cluttered (about 15–20 files, or two or more topics
with three or more files each); give each new subfolder a `README.md` linked
from its parent, and move files with `git mv`. Retired files are deleted, not
parked; git history keeps them.

## Contributor tiers

- **Maintainer agents** act under the owner's standing authority above: claim
  work, open PRs, get independent review, and integrate into `dev` per the playbook.
- **Trusted collaborators** work through gated PRs: required checks and review
  apply, and they never merge their own PRs.
- **Outside forks** are evidence, not trusted code. Never approve fork workflow
  runs; bring good changes in by cherry-pick (keeping the author) after a
  line-by-line security review.
