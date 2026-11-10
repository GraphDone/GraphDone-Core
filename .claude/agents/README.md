# `.claude/agents/` — Claude Code subagents

Subagent definitions Claude Code can start for a focused job, each with its own
tools and model. Keep the procedure in a shared skill in
[`.agents/skills/`](../../.agents/skills/README.md) and make the subagent a thin
wrapper that preloads it, so agents in other harnesses can follow the same
procedure. (Claude Code skips this README because it has no frontmatter.)

```mermaid
flowchart LR
  main["Main session"] -->|"delegates review"| reviewer["pr-reviewer.md"]
  reviewer -->|"preloads"| skill[".agents/skills/review-pr"]
  reviewer -->|"findings"| main
```

## What's here

| File | What it is |
| --- | --- |
| [`pr-reviewer.md`](pr-reviewer.md) | The independent, read-only PR reviewer the dev integration playbook requires before a merge; runs the [`review-pr`](../../.agents/skills/review-pr/SKILL.md) skill on Opus |

`pr-reviewer` has no Edit or Write tool, and the guard hook
([`../hooks/`](../hooks/README.md)) holds its Bash calls to reading: no commit,
push, comment, review or merge. To make another subagent read-only, add its name
to `READ_ONLY_AGENTS` in `guard-git.mjs`. Hooks in a subagent's own frontmatter
did not run in Claude Code 2.1.322, so the rule lives in the shared hook, which
knows the calling subagent from `agent_type`.

Up: [`.claude/`](../README.md)
