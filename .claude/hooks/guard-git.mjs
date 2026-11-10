#!/usr/bin/env node
// PreToolUse hook for Bash: blocks the git and GitHub operations AGENTS.md
// forbids, so the rule holds even when an agent forgets it. Claude Code passes
// the tool call as JSON on stdin; exit code 2 blocks it and shows stderr to the
// agent. Best-effort: it reads the command the way a shell would split it, but
// cannot see through eval, aliases or scripts. Tested by
// tests/toolchain/agents-contract.mjs.
import { spawnSync } from 'node:child_process';
import { readFileSync, realpathSync } from 'node:fs';
import { basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const PROTECTED = new Set(['dev', 'main', 'refs/heads/dev', 'refs/heads/main']);
const SEPARATORS = new Set([';', '&', '|', '(', ')', '\n']);
const WRAPPERS = new Set(['sudo', 'env', 'command', 'nohup', 'time', 'exec', 'nice']);
const SHELLS = new Set(['bash', 'sh', 'zsh', 'dash']);
// git options that take their value as the next word (git <option> <value> push).
const GIT_VALUE_OPTIONS = new Set(['-C', '-c', '--git-dir', '--work-tree', '--namespace', '--config-env', '--super-prefix']);
// gh pr merge options that take their value as the next word.
const MERGE_VALUE_OPTIONS = new Set(['-b', '--body', '-F', '--body-file', '-t', '--subject', '-A', '--author-email', '--match-head-commit', '-R', '--repo']);
// Subagents that may only read (see .claude/agents/). Claude Code names the
// calling subagent in the hook input's agent_type.
const READ_ONLY_AGENTS = new Set(['pr-reviewer']);

// Splits a shell command line into simple commands (arrays of words), reading
// quotes the way a shell does and skipping here-document bodies, so text inside
// a commit message, PR body or heredoc is never mistaken for a command.
export function simpleCommands(line) {
  const commands = [];
  let words = [];
  let word = null;
  const heredocs = [];
  const endWord = () => { if (word !== null) words.push(word); word = null; };
  const endCommand = () => { endWord(); if (words.length) commands.push(words); words = []; };
  const text = String(line);
  let i = 0;
  while (i < text.length) {
    const c = text[i];
    if (c === "'") {
      const close = text.indexOf("'", i + 1);
      const end = close === -1 ? text.length : close;
      word = (word ?? '') + text.slice(i + 1, end);
      i = end + 1;
    } else if (c === '"') {
      let j = i + 1;
      let value = '';
      while (j < text.length && text[j] !== '"') {
        if (text[j] === '\\' && j + 1 < text.length) { value += text[j + 1]; j += 2; } else { value += text[j]; j += 1; }
      }
      word = (word ?? '') + value;
      i = j + 1;
    } else if (c === '\\') {
      if (text[i + 1] !== '\n') word = (word ?? '') + (text[i + 1] ?? '');
      i += 2;
    } else if (c === '<' && text.startsWith('<<', i) && text[i + 2] !== '<') {
      endWord();
      const match = /^<<-?\s*(?:'([^']*)'|"([^"]*)"|([^\s;&|()<>]+))/.exec(text.slice(i));
      if (match) { heredocs.push(match[1] ?? match[2] ?? match[3]); i += match[0].length; } else { i += 2; }
    } else if (c === '\n') {
      endCommand();
      i += 1;
      // Skip each pending here-document body, up to its delimiter line.
      for (const delimiter of heredocs.splice(0)) {
        while (i < text.length) {
          const next = text.indexOf('\n', i);
          const lineEnd = next === -1 ? text.length : next;
          const body = text.slice(i, lineEnd);
          i = lineEnd + 1;
          if (body.replace(/^\t+/, '').trim() === delimiter) break;
        }
      }
    } else if (SEPARATORS.has(c)) {
      endCommand();
      i += 1;
    } else if (c === ' ' || c === '\t') {
      endWord();
      i += 1;
    } else {
      word = (word ?? '') + c;
      i += 1;
    }
  }
  endCommand();
  return commands;
}

const isShortCluster = (arg, letter, allowed = 'a-zA-Z') => new RegExp(`^-[${allowed}]*${letter}[${allowed}]*$`).test(arg);

function pushProblem(args) {
  if (args.some((arg) => /^--force(?:-with-lease|-if-includes)?(?:=|$)/.test(arg) || isShortCluster(arg, 'f'))) {
    return 'Force-pushing is not allowed (AGENTS.md). Push new commits, or merge the base branch instead of rebasing a pushed branch.';
  }
  if (args.some((arg) => arg.startsWith('+'))) return 'A "+" refspec force-pushes; push new commits instead (AGENTS.md).';
  if (args.some((arg) => arg === '--mirror' || /^--prune(?:=|$)/.test(arg))) {
    return '--mirror and --prune can overwrite or delete remote branches, including dev and main (AGENTS.md). Push named branches instead.';
  }
  const deleting = args.some((arg) => arg === '--delete' || isShortCluster(arg, 'd'));
  const targets = args.filter((arg) => !arg.startsWith('-'));
  if (deleting && targets.some((arg) => PROTECTED.has(arg))) return 'Deleting dev or main is never allowed (AGENTS.md).';
  if (targets.some((arg) => arg.startsWith(':') && PROTECTED.has(arg.slice(1)))) return 'Deleting dev or main is never allowed (AGENTS.md).';
  return null;
}

function gitSubcommand(args) {
  let i = 0;
  while (i < args.length && args[i].startsWith('-')) i += GIT_VALUE_OPTIONS.has(args[i]) ? 2 : 1;
  return { sub: args[i], rest: args.slice(i + 1) };
}

function gitProblem(args) {
  const { sub, rest } = gitSubcommand(args);
  return sub === 'push' ? pushProblem(rest) : null;
}

function apiWrites(args) {
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    const method = arg === '-X' || arg === '--method' ? args[i + 1] : (/^(?:-X|--method=)(.+)$/.exec(arg) ?? [])[1];
    if (method && method.toUpperCase() !== 'GET') return true;
    if (['-f', '-F', '--field', '--raw-field', '--input'].includes(arg) || /^(?:-[fF]\S|--(?:field|raw-field|input)=)/.test(arg)) return true;
  }
  return false;
}

// The PR's base branch, asked of GitHub; null when it cannot be found out.
function githubBaseOf({ pr, repo }) {
  const result = spawnSync('gh', ['pr', 'view', ...(pr ? [pr] : []), ...(repo ? ['--repo', repo] : []), '--json', 'baseRefName', '-q', '.baseRefName'], { encoding: 'utf8', timeout: 15000 });
  return result.status === 0 ? result.stdout.trim() || null : null;
}

function mergeTarget(args) {
  let pr; let repo;
  for (let i = 2; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '-R' || arg === '--repo') repo = args[i + 1];
    else if (arg.startsWith('--repo=')) repo = arg.slice('--repo='.length);
    if (MERGE_VALUE_OPTIONS.has(arg)) i += 1;
    else if (!arg.startsWith('-') && pr === undefined) pr = arg;
  }
  return { pr, repo };
}

function ghProblem(args, baseOf) {
  const [group, action] = args;
  if (group === 'pr' && action === 'merge'
    && args.some((arg) => arg === '--delete-branch' || (/^--delete-branch=/.test(arg) && arg !== '--delete-branch=false') || isShortCluster(arg, 'd', 'mrsd'))) {
    return 'Never merge with --delete-branch (-d): a release merge would delete dev (AGENTS.md).';
  }
  if (group === 'pr' && action === 'merge' && args.some((arg) => arg === '--admin' || arg === '--admin=true')) {
    const base = baseOf(mergeTarget(args));
    if (base !== 'dev') {
      return `--admin merges are authorized only into dev (AGENTS.md); this PR's base is ${base ? `"${base}"` : 'unknown (gh pr view failed)'}. Releases to main go through the owner.`;
    }
  }
  if (group === 'repo' && action === 'edit') {
    return 'Repository settings (default branch, auto-delete on merge, visibility) are the owner\'s to change (AGENTS.md). Ask the owner.';
  }
  if (group !== 'api') return null;
  const text = args.join(' ');
  if (action === 'graphql') {
    if (/\bmutation\b/.test(text) && /(?:BranchProtectionRule|Ruleset|deleteRef|updateRef)/.test(text)) {
      return 'Branch protection, rulesets and ref deletion are the owner\'s to change (AGENTS.md). Ask the owner.';
    }
    return null;
  }
  if (!apiWrites(args)) return null;
  if (/\/(?:protection|rulesets)\b/.test(text)) {
    return 'Branch protection and rulesets are the owner\'s to change; never toggle them for a merge (AGENTS.md). Ask the owner.';
  }
  if (/\bgit\/refs\/heads\/(?:dev|main)\b|\bbranches\/(?:dev|main)\/rename\b/.test(text)) {
    return 'Rewriting, renaming or deleting dev or main through the API is never allowed (AGENTS.md).';
  }
  return null;
}

// git subcommands and gh commands a read-only agent may run.
const READ_GIT = new Set(['status', 'log', 'show', 'diff', 'fetch', 'ls-remote', 'ls-files', 'ls-tree', 'rev-parse', 'rev-list',
  'blame', 'grep', 'merge-base', 'cat-file', 'show-ref', 'for-each-ref', 'describe', 'shortlog', 'name-rev', 'diff-tree', 'range-diff', 'help', 'version']);
const READ_GH = new Set(['pr view', 'pr diff', 'pr list', 'pr checks', 'pr status', 'issue view', 'issue list', 'issue status',
  'run view', 'run list', 'run download', 'run watch', 'repo view', 'release view', 'release list', 'workflow list', 'workflow view', 'auth status']);
const READ_ONLY = 'is read-only: it may read, run tests and report, but not commit, push, comment, review, approve, merge or change GitHub (.claude/agents/).';

function readOnlyProblem(program, args, agent) {
  if (program === 'git') {
    const { sub, rest } = gitSubcommand(args);
    const ok = READ_GIT.has(sub)
      || (sub === 'branch' && rest.every((arg) => /^(?:-a|-r|-v|-vv|--list|--show-current|--all|--remotes)$/.test(arg)))
      || (sub === 'worktree' && ['list', 'add'].includes(rest[0]))
      || (sub === 'config' && rest.some((arg) => /^(?:--get|--get-all|--list|-l)$/.test(arg)))
      || (sub === 'remote' && (rest.length === 0 || ['-v', 'show', 'get-url'].includes(rest[0])));
    return ok ? null : `${agent} ${READ_ONLY} Blocked: git ${sub ?? ''}`.trim();
  }
  if (program === 'gh') {
    const [group, action] = args;
    if (group === 'search') return null;
    if (group === 'api') {
      const text = args.join(' ');
      return (action === 'graphql' ? /\bmutation\b/.test(text) : apiWrites(args)) ? `${agent} ${READ_ONLY} Blocked: a gh api write` : null;
    }
    return READ_GH.has(`${group} ${action}`) ? null : `${agent} ${READ_ONLY} Blocked: gh ${group ?? ''} ${action ?? ''}`.trim();
  }
  return null;
}

// Returns why a shell command must be blocked, or null when it may run.
// `agent` is the calling subagent's type, if any; `baseOf` looks up a PR's base
// branch (tests pass a stub instead of asking GitHub).
export function blockReason(command, { agent, baseOf = githubBaseOf } = {}) {
  for (const words of simpleCommands(command)) {
    let i = 0;
    while (i < words.length && (/^[A-Za-z_][A-Za-z0-9_]*=/.test(words[i]) || WRAPPERS.has(basename(words[i])))) i += 1;
    const program = basename(words[i] ?? '');
    const args = words.slice(i + 1);
    let problem = READ_ONLY_AGENTS.has(agent) ? readOnlyProblem(program, args, agent) : null;
    if (!problem && program === 'git') problem = gitProblem(args);
    else if (!problem && program === 'gh') problem = ghProblem(args, baseOf);
    else if (!problem && SHELLS.has(program)) {
      const script = args[args.indexOf('-c') + 1];
      if (args.includes('-c') && script) problem = blockReason(script, { agent, baseOf });
    }
    if (problem) return problem;
  }
  return null;
}

function isMainScript() {
  try {
    return Boolean(process.argv[1]) && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
}

if (isMainScript()) {
  let input = {};
  try { input = JSON.parse(readFileSync(0, 'utf8') || '{}'); } catch { process.exit(0); }
  const reason = input.tool_name === 'Bash' ? blockReason(input.tool_input?.command ?? '', { agent: input.agent_type }) : null;
  if (reason) {
    process.stderr.write(`Blocked by .claude/hooks/guard-git.mjs: ${reason}\n`);
    process.exit(2);
  }
}
