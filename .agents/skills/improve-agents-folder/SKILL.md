---
name: improve-agents-folder
description: Use when you want to add, change or remove agent guidance in this repository — AGENTS.md, a skill, a playbook, a lesson in .agents/inbox or a symptom index — or when guidance you followed turned out to be missing, wrong or stale. Not for product documentation (that goes in docs/).
---

# Improve the agent guidance without growing a pile

Agent guidance is code for agents: it is loaded into every session or read
before every matching task, so each line costs every future agent time and
attention. Change it the way you change code: small, reviewed, tested, and
deleted when it stops being true. The rules are in
[`.agents/README.md`](../../README.md); `tests/toolchain/agents-contract.mjs`
enforces the mechanical ones.

## 1. Decide whether it belongs here at all

| What you have | Where it goes |
| --- | --- |
| A rule nearly every session needs (authority, safety, where files go, the one test gate) | `AGENTS.md`, one or two lines |
| How to do a recurring kind of task | A skill: `.agents/skills/<name>/SKILL.md` |
| What agents may do and the validation bar (policy) | `.agents/playbooks/` |
| One incident: what broke, evidence, cause, the rule, its limits | `.agents/inbox/YYYY-MM-DD-<rule>.md` plus an index row |
| A rule a program can check | A test or contract. Write the lesson only to record why |
| Status, plans, TODOs, session notes, progress reports | A GitHub issue or the PR, never here |
| How the product works, for people | `docs/` or the folder's README |

## 2. Search before you write

```bash
grep -ril "<symptom, error text or file name>" AGENTS.md .agents docs/quality
```

Start from [`.agents/issues/INDEX.md`](../../issues/INDEX.md). If an entry
already covers it, **improve that entry** (sharper rule, new evidence, the test
that now guards it) instead of adding a near-duplicate.

## 3. Make the change earn its place

- A lesson names the regression test or check that now enforces its rule, or
  says plainly why none is possible.
- A skill is a procedure you would otherwise rediscover: real commands that
  you ran, the files involved, how to tell it worked. Keep it under 150 lines;
  link to docs instead of copying them.
- Write current truth only. Never describe intended future behaviour as fact.
- Public repository: no private hostnames, IPs, home paths or private repo
  names (`tests/toolchain/public-content-contract.mjs`).

Never change the **Authority** or **Contributor tiers** sections of `AGENTS.md`,
or the playbooks, except on the owner's explicit instruction. They are the
owner's rules, not guidance you maintain.

## 4. Remove as much as you add

In the same PR:

- **Merge duplicates.** When two lessons state the same rule, keep the clearer
  one, add the other's evidence to it, delete the other and repoint its index rows.
- **Promote repeated rules.** When three or more lessons share a rule, put the
  rule in a skill or `AGENTS.md`, link the lessons from it, and delete lessons
  whose only value was repeating it.
- **Retire stale entries.** When the code, test or setting an entry describes
  is gone or superseded, delete the entry and its index row. Git keeps history;
  nothing is "archived" in the tree.
- **Fix what misled you.** If guidance cost you time because it was wrong, fix
  or delete it in the PR for the work it slowed down.

## 5. Check and land it

```bash
node --test tests/toolchain/agents-contract.mjs tests/toolchain/readme-contract.mjs
```

Open a PR with the change (alone, or alongside the fix it documents). In the
description, list what was added, merged and deleted, and why any net growth is
worth its cost. Guidance changes get the same review as code.
