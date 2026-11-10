import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, lstatSync, readFileSync, readlinkSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { blockReason } from '../../.claude/hooks/guard-git.mjs';

// Keeps the agent guidance small, linked and current (.agents/README.md has the
// rules; the improve-agents-folder skill has the procedure). Budgets here may
// only tighten.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const read = (path) => readFileSync(resolve(root, path), 'utf8').replace(/\r\n/g, '\n');

// Committed and staged files only, so local junk (.DS_Store, editor swap files,
// ignored output) never fails the contract.
function tracked() {
  const result = spawnSync('git', ['ls-files', '--cached', '-z'], { cwd: root, encoding: 'utf8' });
  assert.equal(result.status, 0, `git ls-files failed: ${result.stderr}`);
  // A tracked file deleted in the working tree is skipped, not an ENOENT crash.
  return result.stdout.split('\0').filter((path) => path && existsSync(resolve(root, path)));
}
const files = tracked();
const childrenOf = (dir) => [...new Set(files.filter((path) => path.startsWith(`${dir}/`)).map((path) => path.slice(dir.length + 1).split('/')[0]))];
const filesIn = (dir) => files.filter((path) => path.startsWith(`${dir}/`) && !path.slice(dir.length + 1).includes('/'));

export const AGENTS_ENTRIES = ['README.md', 'inbox', 'issues', 'playbooks', 'skills'];
export const AGENTS_MD_MAX_LINES = 200;
export const SKILL_MAX_LINES = 150;
export const LESSON_NAME = /^\d{4}-\d{2}-\d{2}-[a-z0-9]+(?:-[a-z0-9]+)*\.md$/;

export function parseFrontmatter(text) {
  const match = /^---\n([\s\S]*?)\n---\n/.exec(text.replace(/\r\n/g, '\n'));
  if (!match) return null;
  const fields = {};
  let key = null;
  for (const line of match[1].split('\n')) {
    const field = /^([a-z][a-z0-9_-]*):\s*(.*)$/.exec(line);
    if (field) {
      key = field[1];
      fields[key] = /^[>|][+-]?$/.test(field[2].trim()) ? '' : field[2].trim();
    } else if (key && /^\s+\S/.test(line)) {
      fields[key] = `${fields[key]} ${line.trim()}`.trim();
    }
  }
  return fields;
}

export function skillProblems(dirName, text) {
  const problems = [];
  const fields = parseFrontmatter(text);
  if (!fields) return [`${dirName}: SKILL.md must start with --- frontmatter ---`];
  if (fields.name !== dirName) problems.push(`${dirName}: frontmatter name "${fields.name}" must equal the folder name`);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(dirName) || dirName.length > 64) problems.push(`${dirName}: name must be lowercase-hyphenated, at most 64 characters`);
  if (!fields.description || fields.description.length < 40) problems.push(`${dirName}: description must say when to use the skill`);
  if (fields.description && fields.description.length > 1024) problems.push(`${dirName}: description is over 1024 characters`);
  const lines = text.split('\n').length;
  if (lines > SKILL_MAX_LINES) problems.push(`${dirName}: ${lines} lines (budget ${SKILL_MAX_LINES}); link to docs instead of copying them`);
  return problems;
}

export function relativeLinks(text) {
  const prose = text.replace(/```[\s\S]*?```/g, '').replace(/`[^`\n]*`/g, '');
  return [...prose.matchAll(/\]\(([^)\s]+)(?:\s+(?:"[^"]*"|'[^']*'|\([^)]*\)))?\)/g)]
    .map((match) => match[1].split('#')[0])
    .filter((target) => target && !/^[a-z]+:/i.test(target));
}


test('.agents holds only its four kinds of guidance', () => {
  const extra = childrenOf('.agents').filter((name) => !AGENTS_ENTRIES.includes(name));
  assert.deepEqual(extra, [], `Unexpected .agents entries: ${extra.join(', ')}. See .agents/README.md for where things go.`);
});

test('every lesson is dated and reachable from a symptom index', () => {
  const lessons = childrenOf('.agents/inbox').filter((name) => name !== 'README.md');
  const badNames = lessons.filter((name) => !LESSON_NAME.test(name));
  assert.deepEqual(badNames, [], `Lesson names must be YYYY-MM-DD-<rule>.md: ${badNames.join(', ')}`);
  const indexes = filesIn('.agents/issues').filter((path) => path.endsWith('.md')).map(read).join('\n');
  const orphans = lessons.filter((name) => !indexes.includes(`inbox/${name}`));
  assert.deepEqual(orphans, [], `Lessons no index links to (add an index row, merge or delete them): ${orphans.join(', ')}`);
});

test('every skill is well-formed, within budget and listed in AGENTS.md', () => {
  const agentsMd = read('AGENTS.md');
  const skills = childrenOf('.agents/skills').filter((name) => name !== 'README.md').map((name) => ({ name }));
  assert.ok(skills.length > 0, 'expected at least one skill');
  const problems = [];
  for (const { name } of skills) {
    const path = `.agents/skills/${name}/SKILL.md`;
    if (!existsSync(resolve(root, path))) { problems.push(`${name}: missing SKILL.md`); continue; }
    problems.push(...skillProblems(name, read(path)));
    if (!agentsMd.includes(`.agents/skills/${name}/SKILL.md`)) problems.push(`${name}: not listed in the AGENTS.md skills table`);
    if (!read('.agents/skills/README.md').includes(`${name}/SKILL.md`)) problems.push(`${name}: not listed in .agents/skills/README.md`);
  }
  assert.deepEqual(problems, []);
});

test('AGENTS.md stays small and CLAUDE.md loads it', () => {
  const lines = read('AGENTS.md').split('\n').length;
  assert.ok(lines <= AGENTS_MD_MAX_LINES, `AGENTS.md has ${lines} lines (budget ${AGENTS_MD_MAX_LINES}); move procedures into a skill`);
  assert.ok(read('CLAUDE.md').split('\n').some((line) => line.trim() === '@AGENTS.md'), 'CLAUDE.md must import @AGENTS.md so Claude Code loads it');
});

test('.claude is a real folder whose skills link to .agents/skills', () => {
  assert.ok(lstatSync(resolve(root, '.claude')).isDirectory(), '.claude must be a real directory: Claude Code refuses worktrees under a symlinked .claude');
  const skills = resolve(root, '.claude/skills');
  assert.ok(lstatSync(skills).isSymbolicLink(), '.claude/skills must be a symlink');
  assert.equal(readlinkSync(skills), '../.agents/skills');
});

test('links in agent guidance resolve', () => {
  const guidance = ['AGENTS.md', ...files.filter((path) => path.startsWith('.agents/') && path.endsWith('.md'))];
  const broken = [];
  for (const file of guidance) {
    for (const target of relativeLinks(read(file))) {
      if (!existsSync(resolve(root, dirname(file), target))) broken.push(`${file} -> ${target}`);
    }
  }
  assert.deepEqual(broken, []);
});

test('the rules catch what they are meant to catch', () => {
  assert.ok(LESSON_NAME.test('2026-11-09-edges-before-items.md'));
  assert.ok(!LESSON_NAME.test('notes-from-today.md'));
  assert.ok(!LESSON_NAME.test('2026-11-09_Status.md'));
  assert.deepEqual(skillProblems('good-skill', '---\nname: good-skill\ndescription: Use when a recurring task needs these exact steps to be followed.\n---\nBody\n'), []);
  assert.equal(skillProblems('x', 'no frontmatter').length, 1);
  assert.ok(skillProblems('a-skill', '---\nname: other\ndescription: short\n---\n').length >= 2);
  assert.ok(skillProblems('long', `---\nname: long\ndescription: ${'d'.repeat(50)}\n---\n${'line\n'.repeat(SKILL_MAX_LINES)}`).some((p) => p.includes('budget')));
  assert.deepEqual(relativeLinks('[a](x.md) `[b](y.md)` [c](https://e.x) [d](#top) [t](w.md "title") [s](v.md \'t\')\n```\n[e](z.md)\n```'), ['x.md', 'w.md', 'v.md']);
  assert.equal(parseFrontmatter('---\r\nname: a\r\ndescription: >\r\n  folded text\r\n  continues\r\n---\r\nbody').description, 'folded text continues');
});

test('the Claude Code guard hook blocks forbidden git and GitHub operations', () => {
  const settings = JSON.parse(read('.claude/settings.json'));
  const hook = settings.hooks.PreToolUse.find((entry) => entry.matcher === 'Bash').hooks[0];
  assert.equal(hook.command, '${CLAUDE_PROJECT_DIR}/.claude/hooks/guard-git.mjs');
  assert.ok(lstatSync(resolve(root, '.claude/hooks/guard-git.mjs')).mode & 0o111, 'guard-git.mjs must be executable');
  const blocked = [
    'git push --force origin feature',
    'git push -f',
    'git push --force-with-lease origin agents-sweep',
    'git -C repo push origin +feature',
    'git push origin --delete dev',
    'git push origin :main',
    'cd x && git push origin --delete refs/heads/dev',
    'gh pr merge 12 --merge --delete-branch',
    'gh api -X DELETE repos/o/r/branches/dev/protection/enforce_admins',
    'gh api repos/o/r/branches/dev/protection/enforce_admins --method POST',
    'gh api repos/o/r/rulesets/7 -X PUT --input r.json',
    'gh pr merge 12 -d',
    'gh pr merge 12 --merge --delete-branch=true',
    'gh pr merge 12 -md',
    'gh api -X DELETE repos/o/r/git/refs/heads/dev',
    'GH_TOKEN=x gh api --method DELETE repos/o/r/git/refs/heads/main',
    'gh api -X PATCH repos/o/r/git/refs/heads/dev -F sha=abc -F force=true',
    'gh api graphql -f query=\'mutation { deleteBranchProtectionRule(input: {}) { clientMutationId } }\'',
    'gh repo edit --delete-branch-on-merge',
    'git push --mirror origin',
    'git push --prune origin "refs/heads/*:refs/heads/*"',
    'git --no-pager push --force',
    'git --git-dir=.git push --force',
    '/usr/bin/git push --force',
    'git -C repo -c a=b push -f',
    'git push origin :"dev"',
    '(git push -f origin feature)',
    'echo $(git push -f origin feature)',
    'bash -c "git push --force origin feature"',
    'git commit -m x\ngit push -f origin feature',
  ];
  const allowed = [
    'git push -u origin feature',
    'git push origin HEAD',
    'git push origin --delete old-feature',
    'git commit -m "explain why --delete-branch and --force are banned"',
    'gh pr merge 12 --merge --admin --match-head-commit abc123',
    'gh api repos/o/r/branches/dev/protection',
    'gh api repos/o/r/branches/dev/protection --jq .enforce_admins.enabled',
    'npm run test:toolchain',
    'git commit -m "docs: say why; git push -f origin dev is banned"',
    'gh pr create --body "The hook blocks force pushes && git push --force to dev"',
    'git commit -m "a" -m "b\ngit push --force is blocked now"',
    'gh pr create --title t --body "$(cat <<\'EOF\'\ngit push -f origin feature\nEOF\n)"',
    'git commit -F - <<\'EOF\'\nnever run git push -f origin dev; or gh pr merge 1 -d\nEOF\ngit push origin feature',
    'git commit -m "mention gh pr merge --delete-branch | rule"',
    'grep -rn "git push --force" docs',
    'git fetch -f origin',
    'gh api repos/o/r/git/refs/heads/dev',
    'gh pr merge 12 --merge --delete-branch=false',
  ];
  // PR bases for --admin merges, instead of asking GitHub: 13 targets main, 14 cannot be looked up.
  const bases = { 13: 'main', 14: null };
  const baseOf = ({ pr }) => (pr in bases ? bases[pr] : 'dev');
  for (const command of blocked) assert.ok(blockReason(command, { baseOf }), `should block: ${command}`);
  for (const command of allowed) assert.equal(blockReason(command, { baseOf }), null, `should allow: ${command}`);
  for (const command of ['gh pr merge 13 --merge --admin', 'gh pr merge 14 --admin', 'gh pr merge --repo o/r -b "msg 12" 13 --admin']) {
    assert.ok(blockReason(command, { baseOf }), `should block an --admin merge not into dev: ${command}`);
  }
});

test('the pr-reviewer subagent may only read', () => {
  const baseOf = () => 'dev';
  const agent = 'pr-reviewer';
  const blocked = [
    'git commit -m "fix"', 'git push origin feature', 'git checkout -b x', 'git reset --hard', 'git branch -D x',
    'git config user.name x', 'gh pr review 12 --approve', 'gh pr comment 12 --body hi', 'gh pr merge 12 --merge',
    'gh issue comment 1 --body hi', 'gh api -X POST repos/o/r/issues/1/comments -f body=x',
    'gh api graphql -f query=\'mutation { addComment(input: {}) { clientMutationId } }\'', 'bash -c "git push origin x"',
  ];
  const allowed = [
    'git status', 'git log --oneline -5', 'git diff abc...def', 'git fetch origin', 'git ls-remote origin refs/heads/dev',
    'git -C repo show HEAD:AGENTS.md', 'git branch -a', 'git worktree add ../review abc', 'git config --get remote.origin.url',
    'gh pr view 12 --json files', 'gh pr diff 12', 'gh pr checks 12', 'gh api repos/o/r/pulls/12/files',
    'gh api graphql -f query=\'query { viewer { login } }\'', 'npm run test:toolchain', 'node --test tests/toolchain/agents-contract.mjs',
  ];
  for (const command of blocked) assert.ok(blockReason(command, { agent, baseOf }), `pr-reviewer should not run: ${command}`);
  for (const command of allowed) assert.equal(blockReason(command, { agent, baseOf }), null, `pr-reviewer should run: ${command}`);
  assert.equal(blockReason('git commit -m "fix"', { baseOf }), null, 'the main session may commit');
});
