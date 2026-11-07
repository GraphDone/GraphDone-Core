#!/usr/bin/env node
// Release gate for a pushed `v*` tag. Pure functions are exported for tests.
//
//   node scripts/verify-release.mjs           verify the tag; write sha/version to $GITHUB_OUTPUT
//   node scripts/verify-release.mjs --latest  decide whether this version becomes `latest`
//
// Verification fails closed unless the tag points at a commit on main's
// first-parent line (a commit main itself was at, not a dev commit merged into
// it), every workspace manifest carries the tag version, and the newest attempt
// of each required job passed in a CI/Comprehensive run triggered by a push to
// main for that exact commit. On main pushes, CI Success includes the
// production-stack gate.
import { readFileSync, appendFileSync, readdirSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

// Required by branch protection (issue #187).
export const REQUIRED_CHECKS = [
  'CI Success',
  'Unit Tests (Node 22.18.0)',
  'Unit Tests (Node 24.x)',
  'Installer & Deploy Config',
];

const SEMVER = /^v(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z]+(?:\.[0-9A-Za-z]+)*))?$/;

export function parseTag(tag) {
  const match = SEMVER.exec(tag ?? '');
  if (!match) throw new Error(`Tag "${tag}" is not vMAJOR.MINOR.PATCH[-suffix]`);
  const [, major, minor, patch, suffix] = match;
  return { version: tag.slice(1), parts: [Number(major), Number(minor), Number(patch)], suffix: suffix ?? '' };
}

// Semver precedence: numbers, then a version without a suffix outranks the same
// version with one, then suffix identifiers (numeric < alphanumeric).
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

export function checkVersions(version, manifests) {
  const wrong = Object.entries(manifests).filter(([, v]) => v !== version);
  if (wrong.length) {
    throw new Error(`package versions do not match ${version}: ${wrong.map(([f, v]) => `${f}=${v}`).join(', ')}`);
  }
}

// `firstParents` is `git rev-list --first-parent origin/main`, newest first.
export function onMainLine(sha, firstParents) {
  return firstParents.includes(sha);
}

// Keep only jobs from workflow runs that a push to main triggered for `sha`.
// `runs` are Actions workflow runs; `jobsByRun` maps run id → that run's jobs
// (latest attempt). Pull-request runs test a merge ref, not this commit.
export function mainPushJobs(sha, runs, jobsByRun) {
  return runs
    .filter(run => run.event === 'push' && run.head_branch === 'main' && run.head_sha === sha)
    .flatMap(run => jobsByRun[run.id] ?? []);
}

// The newest attempt of each required job decides; pending, missing, skipped,
// cancelled, neutral or failed results all block publication.
export function evaluateChecks(jobs, required = REQUIRED_CHECKS) {
  const problems = [];
  for (const name of required) {
    const latest = jobs
      .filter(job => job.name === name)
      .sort((a, b) => String(b.started_at ?? '').localeCompare(String(a.started_at ?? '')))[0];
    if (!latest) problems.push(`${name}: missing`);
    else if (latest.status !== 'completed') problems.push(`${name}: ${latest.status}`);
    else if (latest.conclusion !== 'success') problems.push(`${name}: ${latest.conclusion}`);
  }
  return problems;
}

// `published` are tags of published (non-draft) GitHub releases. A version
// becomes latest only if it outranks every other published release; once any
// stable release exists, suffixed (pre-release) versions never become latest.
export function isLatest(version, published) {
  const others = published.filter(tag => SEMVER.test(tag) && tag !== `v${version}`).map(tag => tag.slice(1));
  if (parseTag(`v${version}`).suffix && others.some(v => !parseTag(`v${v}`).suffix)) return false;
  return others.every(v => compareVersions(version, v) > 0);
}

const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();

function api(token) {
  return async path => {
    const response = await fetch(`https://api.github.com/${path}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' },
    });
    if (!response.ok) throw new Error(`GET ${path} failed: HTTP ${response.status}`);
    return response.json();
  };
}

async function mainPushJobsFor(get, repo, sha) {
  const { workflow_runs: runs } = await get(`repos/${repo}/actions/runs?head_sha=${sha}&event=push&branch=main&per_page=100`);
  const jobsByRun = {};
  for (const run of runs) {
    const jobs = [];
    for (let page = 1; page <= 10; page++) {
      const body = await get(`repos/${repo}/actions/runs/${run.id}/jobs?filter=latest&per_page=100&page=${page}`);
      jobs.push(...body.jobs);
      if (jobs.length >= body.total_count || body.jobs.length === 0) break;
    }
    jobsByRun[run.id] = jobs;
  }
  return mainPushJobs(sha, runs, jobsByRun);
}

async function publishedReleaseTags(get, repo) {
  const tags = [];
  for (let page = 1; page <= 10; page++) {
    const releases = await get(`repos/${repo}/releases?per_page=100&page=${page}`);
    tags.push(...releases.filter(release => !release.draft).map(release => release.tag_name));
    if (releases.length < 100) break;
  }
  return tags;
}

async function main() {
  const { GITHUB_REF_NAME: tag, GITHUB_SHA: sha, GITHUB_REPOSITORY: repo, GITHUB_TOKEN: token, GITHUB_OUTPUT: output } = process.env;
  if (!tag || !sha || !repo || !token) throw new Error('GITHUB_REF_NAME, GITHUB_SHA, GITHUB_REPOSITORY and GITHUB_TOKEN are required');
  const { version } = parseTag(tag);
  const get = api(token);
  const emit = lines => {
    console.log(lines.join('\n'));
    if (output) appendFileSync(output, `${lines.join('\n')}\n`);
  };

  if (process.argv.includes('--latest')) {
    emit([`latest=${isLatest(version, await publishedReleaseTags(get, repo))}`]);
    return;
  }

  if (git('rev-parse', `refs/tags/${tag}^{commit}`) !== sha) throw new Error(`${tag} does not point at ${sha}`);

  git('fetch', '--no-tags', 'origin', '+refs/heads/main:refs/remotes/origin/main');
  if (!onMainLine(sha, git('rev-list', '--first-parent', 'refs/remotes/origin/main').split('\n'))) {
    throw new Error(`${sha} is not a commit main was at (first-parent); tag the main merge commit that main CI validated`);
  }

  const manifests = { 'package.json': JSON.parse(readFileSync('package.json', 'utf8')).version };
  for (const dir of readdirSync('packages')) {
    const file = `packages/${dir}/package.json`;
    if (existsSync(file)) manifests[file] = JSON.parse(readFileSync(file, 'utf8')).version;
  }
  checkVersions(version, manifests);

  const problems = evaluateChecks(await mainPushJobsFor(get, repo, sha));
  if (problems.length) throw new Error(`required main-push checks have not passed on ${sha}:\n  ${problems.join('\n  ')}`);

  emit([`sha=${sha}`, `version=${version}`]);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch(error => {
    console.error(`::error::${error.message}`);
    process.exit(1);
  });
}
