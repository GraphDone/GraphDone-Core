import assert from 'node:assert/strict';
import { existsSync, lstatSync, readFileSync, readdirSync, readlinkSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

// Keeps the agent guidance small, linked and current (.agents/README.md has the
// rules; the improve-agents-folder skill has the procedure). Budgets here may
// only tighten.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const read = (path) => readFileSync(resolve(root, path), 'utf8');

export const AGENTS_ENTRIES = ['README.md', 'inbox', 'issues', 'playbooks', 'skills'];
export const AGENTS_MD_MAX_LINES = 200;
export const SKILL_MAX_LINES = 150;
export const LESSON_NAME = /^\d{4}-\d{2}-\d{2}-[a-z0-9]+(?:-[a-z0-9]+)*\.md$/;

export function parseFrontmatter(text) {
  const match = /^---\n([\s\S]*?)\n---\n/.exec(text);
  if (!match) return null;
  const fields = {};
  for (const line of match[1].split('\n')) {
    const field = /^([a-z][a-z0-9_-]*):\s*(.*)$/.exec(line);
    if (field) fields[field[1]] = field[2].trim();
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
  return [...prose.matchAll(/\]\(([^)\s]+)\)/g)]
    .map((match) => match[1].split('#')[0])
    .filter((target) => target && !/^[a-z]+:/i.test(target));
}

function markdownUnder(dir) {
  const out = [];
  for (const entry of readdirSync(resolve(root, dir), { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...markdownUnder(path));
    else if (entry.name.endsWith('.md')) out.push(path);
  }
  return out;
}

test('.agents holds only its four kinds of guidance', () => {
  const extra = readdirSync(resolve(root, '.agents')).filter((name) => !AGENTS_ENTRIES.includes(name));
  assert.deepEqual(extra, [], `Unexpected .agents entries: ${extra.join(', ')}. See .agents/README.md for where things go.`);
});

test('every lesson is dated and reachable from a symptom index', () => {
  const lessons = readdirSync(resolve(root, '.agents/inbox')).filter((name) => name !== 'README.md');
  const badNames = lessons.filter((name) => !LESSON_NAME.test(name));
  assert.deepEqual(badNames, [], `Lesson names must be YYYY-MM-DD-<rule>.md: ${badNames.join(', ')}`);
  const indexes = readdirSync(resolve(root, '.agents/issues')).map((name) => read(`.agents/issues/${name}`)).join('\n');
  const orphans = lessons.filter((name) => !indexes.includes(`inbox/${name}`));
  assert.deepEqual(orphans, [], `Lessons no index links to (add an index row, merge or delete them): ${orphans.join(', ')}`);
});

test('every skill is well-formed, within budget and listed in AGENTS.md', () => {
  const agentsMd = read('AGENTS.md');
  const skills = readdirSync(resolve(root, '.agents/skills'), { withFileTypes: true }).filter((entry) => entry.isDirectory());
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
  const files = ['AGENTS.md', ...markdownUnder('.agents')];
  const broken = [];
  for (const file of files) {
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
  assert.deepEqual(relativeLinks('[a](x.md) `[b](y.md)` [c](https://e.x) [d](#top)\n```\n[e](z.md)\n```'), ['x.md']);
});
