#!/usr/bin/env node
// Release gate: decides whether a pushed `v*` tag may publish images and a
// GitHub release. Pure functions are exported for tests; the CLI reads the
// tagged tree, the main branch and the commit's check runs, then writes
// `sha`, `version` and `latest` to $GITHUB_OUTPUT. Any doubt fails closed.
import { readFileSync, appendFileSync, readdirSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

// The checks protected branches require (issue #187). `CI Success` already
// aggregates every CI job, including the production-stack gate on main.
export const REQUIRED_CHECKS = [
  'CI Success',
  'Unit Tests (Node 22.18.0)',
  'Unit Tests (Node 24.x)',
  'Installer & Deploy Config',
];

const SEMVER = /^v(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/;

export function parseTag(tag) {
  const match = SEMVER.exec(tag ?? '');
  if (!match) throw new Error(`Tag "${tag}" is not vMAJOR.MINOR.PATCH[-suffix]`);
  const [, major, minor, patch, suffix] = match;
  return { version: tag.slice(1), parts: [Number(major), Number(minor), Number(patch)], suffix: suffix ?? '' };
}

// Semver precedence, enough for our tags: numbers first, then a version
// without a suffix outranks the same version with one, then suffixes compare
// as dot-separated identifiers (numeric < alphanumeric).
export function compareVersions(a, b) {
  const x = parseTag(`v${a}`);
  const y = parseTag(`v${b}`);
  for (let i = 0; i < 3; i++) if (x.parts[i] !== y.parts[i]) return x.parts[i] - y.parts[i];
  if (x.suffix === y.suffix) return 0;
  if (!x.suffix) return 1;
  if (!y.suffix) return -1;
  const xs = x.suffix.split('.');
  const ys = y.suffix.split('.');
  for (let i = 0; i < Math.max(xs.length, ys.length); i++) {
    if (xs[i] === undefined) return -1;
    if (ys[i] === undefined) return 1;
    const xn = /^\d+$/.test(xs[i]);
    const yn = /^\d+$/.test(ys[i]);
    if (xn && yn && Number(xs[i]) !== Number(ys[i])) return Number(xs[i]) - Number(ys[i]);
    if (xn !== yn) return xn ? -1 : 1;
    if (xs[i] !== ys[i]) return xs[i] < ys[i] ? -1 : 1;
  }
  return 0;
}

// Every workspace manifest must already carry the tag's version, so the
// published images are built from a tree whose version was validated by CI.
export function checkVersions(version, manifests) {
  const wrong = Object.entries(manifests).filter(([, v]) => v !== version);
  if (wrong.length) {
    throw new Error(`package versions do not match ${version}: ${wrong.map(([f, v]) => `${f}=${v}`).join(', ')}`);
  }
}

// `runs` are GitHub check runs for the exact commit. The newest run of each
// required name decides; pending, missing, skipped, cancelled, neutral or
// failed results all block publication.
export function evaluateChecks(runs, required = REQUIRED_CHECKS) {
  const problems = [];
  for (const name of required) {
    const latest = runs
      .filter(run => run.name === name)
      .sort((a, b) => String(b.started_at ?? '').localeCompare(String(a.started_at ?? '')))[0];
    if (!latest) problems.push(`${name}: missing`);
    else if (latest.status !== 'completed') problems.push(`${name}: ${latest.status}`);
    else if (latest.conclusion !== 'success') problems.push(`${name}: ${latest.conclusion}`);
  }
  return problems;
}

export function isLatest(version, existingTags) {
  return existingTags
    .filter(tag => SEMVER.test(tag) && tag !== `v${version}`)
    .every(tag => compareVersions(version, tag.slice(1)) > 0);
}

const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();

async function fetchCheckRuns(repo, sha, token) {
  const runs = [];
  for (let page = 1; page <= 10; page++) {
    const response = await fetch(`https://api.github.com/repos/${repo}/commits/${sha}/check-runs?per_page=100&page=${page}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' },
    });
    if (!response.ok) throw new Error(`check-runs request failed: HTTP ${response.status}`);
    const body = await response.json();
    runs.push(...body.check_runs);
    if (runs.length >= body.total_count || body.check_runs.length === 0) break;
  }
  return runs;
}

async function main() {
  const { GITHUB_REF_NAME: tag, GITHUB_SHA: sha, GITHUB_REPOSITORY: repo, GITHUB_TOKEN: token, GITHUB_OUTPUT: output } = process.env;
  if (!tag || !sha || !repo || !token) throw new Error('GITHUB_REF_NAME, GITHUB_SHA, GITHUB_REPOSITORY and GITHUB_TOKEN are required');

  const { version } = parseTag(tag);
  if (git('rev-parse', `${tag}^{commit}`) !== sha) throw new Error(`${tag} does not point at ${sha}`);

  git('fetch', '--no-tags', 'origin', '+refs/heads/main:refs/remotes/origin/main');
  try {
    git('merge-base', '--is-ancestor', sha, 'refs/remotes/origin/main');
  } catch {
    throw new Error(`${sha} is not on main; tag a commit that main CI validated`);
  }

  const manifests = { 'package.json': JSON.parse(readFileSync('package.json', 'utf8')).version };
  for (const dir of readdirSync('packages')) {
    const file = `packages/${dir}/package.json`;
    if (existsSync(file)) manifests[file] = JSON.parse(readFileSync(file, 'utf8')).version;
  }
  checkVersions(version, manifests);

  const problems = evaluateChecks(await fetchCheckRuns(repo, sha, token));
  if (problems.length) throw new Error(`required checks have not passed on ${sha}:\n  ${problems.join('\n  ')}`);

  git('fetch', '--tags', '--force', 'origin');
  const latest = isLatest(version, git('tag', '--list', 'v*').split('\n').filter(Boolean));

  const lines = [`sha=${sha}`, `version=${version}`, `latest=${latest}`];
  console.log(lines.join('\n'));
  if (output) appendFileSync(output, `${lines.join('\n')}\n`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch(error => {
    console.error(`::error::${error.message}`);
    process.exit(1);
  });
}
