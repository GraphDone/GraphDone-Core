#!/usr/bin/env node
// PreToolUse hook for Bash: blocks the git and GitHub operations AGENTS.md
// forbids, so the rule holds even when an agent forgets it. Claude Code passes
// the tool call as JSON on stdin; exit code 2 blocks it and shows stderr to the
// agent. Tested by tests/toolchain/agents-contract.mjs.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const PROTECTED = new Set(['dev', 'main', 'refs/heads/dev', 'refs/heads/main']);
const WRITE_METHOD = /(?:^|\s)(?:-X|--method)[\s=]*(DELETE|POST|PUT|PATCH)\b/i;
const FIELD_FLAG = /(?:^|\s)(?:-f|-F|--field|--raw-field|--input)(?:\s|=)/;

function tokens(segment) {
  return segment.match(/"[^"]*"|'[^']*'|\S+/g)?.map((token) => token.replace(/^["']|["']$/g, '')) ?? [];
}

function pushProblem(args) {
  const force = args.some((arg) => /^--force(?:-with-lease|-if-includes)?(?:=|$)/.test(arg) || /^-[a-zA-Z]*f[a-zA-Z]*$/.test(arg));
  if (force) return 'Force-pushing is not allowed (AGENTS.md). Push new commits, or merge the base branch instead of rebasing a pushed branch.';
  if (args.some((arg) => arg.startsWith('+'))) return 'A "+" refspec force-pushes; push new commits instead (AGENTS.md).';
  const deleting = args.includes('--delete') || args.includes('-d');
  const targets = args.filter((arg) => !arg.startsWith('-'));
  if (deleting && targets.some((arg) => PROTECTED.has(arg))) return 'Deleting dev or main is never allowed (AGENTS.md).';
  if (targets.some((arg) => arg.startsWith(':') && PROTECTED.has(arg.slice(1)))) return 'Deleting dev or main is never allowed (AGENTS.md).';
  return null;
}

// Returns why a shell command must be blocked, or null when it may run.
export function blockReason(command) {
  for (const segment of String(command).split(/&&|\|\||[;|\n]/)) {
    const args = tokens(segment.trim());
    const git = args.indexOf('git');
    if (git !== -1) {
      let i = git + 1;
      while (args[i] === '-C' || args[i] === '-c') i += 2;
      if (args[i] === 'push') {
        const problem = pushProblem(args.slice(i + 1));
        if (problem) return problem;
      }
    }
    const gh = args.indexOf('gh');
    if (gh === -1) continue;
    const sub = args.slice(gh + 1);
    if (sub[0] === 'pr' && sub[1] === 'merge' && sub.includes('--delete-branch')) {
      return 'Never merge with --delete-branch: a release merge would delete dev (AGENTS.md).';
    }
    if (sub[0] === 'api' && /\/(?:protection|rulesets)\b/.test(segment) && (WRITE_METHOD.test(segment) || FIELD_FLAG.test(segment))) {
      return 'Branch protection and rulesets are the owner\'s to change; never toggle them for a merge (AGENTS.md). Ask the owner.';
    }
  }
  return null;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  let input = {};
  try { input = JSON.parse(readFileSync(0, 'utf8') || '{}'); } catch { process.exit(0); }
  const reason = input.tool_name === 'Bash' ? blockReason(input.tool_input?.command ?? '') : null;
  if (reason) {
    process.stderr.write(`Blocked by .claude/hooks/guard-git.mjs: ${reason}\n`);
    process.exit(2);
  }
}
