---
name: folder-readme
description: Use when you create a folder, move files between folders, or change what a folder is for, and when a folder's README.md is missing, wrong or stale. Every tracked folder in this repository keeps a README.md with a Mermaid diagram so people can navigate from GitHub.
---

# Keep folder READMEs useful

Every tracked folder has a `README.md` that lets someone browsing GitHub learn
what the folder holds, why it exists and where to go next.
`tests/toolchain/readme-contract.mjs` checks that each one exists, has a
diagram that parses with the repository's own Mermaid, and has links that
resolve. It cannot check that the README is *useful*; that is your job.

Exceptions: `packages/web/public/` and below (everything there is served on the
live site, so `packages/web/README.md` describes it), and skill folders under
`.agents/skills/` (their `SKILL.md` is the description).

## What a good README says

1. **Title**: `` # `path/` — what it is `` in a few words.
2. **Why it exists and how it fits**: which command, workflow, package or page
   uses it, and what it uses. Name the real entry point.
3. **One diagram of a real relationship**: a call path, data flow, build or run
   order. Not one box per file. At most about 8 nodes; quote labels
   (`a["Label"]`).
4. **What's here**: a table whose first column links each file or subfolder
   (subfolders link to their README), with one line each on what it does.
5. **Where to start / how to run**, when that is not obvious.
6. **`Up:`** link to the parent README.

Write current truth only: check claims against the code, `package.json`
scripts and `.github/workflows/`. If something is unused or stale, say so
plainly or fix it; do not pad a thin folder. Keep it under about 50 lines; link
to `docs/` for anything longer.

## When you change folders

- New folder: add its README and a row in the parent README in the same PR.
- Moved or deleted files: update the folder's table and any links to them.
- Split a cluttered folder only when `AGENTS.md#repository-map` says to.

## Check

```bash
node --test tests/toolchain/readme-contract.mjs
```
