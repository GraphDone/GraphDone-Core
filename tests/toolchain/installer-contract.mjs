import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const INSTALLER = 'scripts/install.sh';

// The one-line installer is served from main, so it installs main unless the
// GRAPHDONE_REF override says otherwise. Every ref it hands to git or puts in
// a download URL must be that one variable: a hard-coded branch is how
// fix/first-start broke every fresh install once the branch was deleted (#243).
const REF_VAR = /^"?\$\{?GRAPHDONE_REF\}?"?$/;
const GIT_REF_TOKENS = new Set(['FETCH_HEAD', 'origin']);
// Published images may only be pulled by a moving release channel or a version.
const IMAGE_TAG = /^(latest|v?\d+\.\d+\.\d+(-[0-9A-Za-z.]+)?|\$\{[A-Z0-9_]+(:-[^}]*)?\})$/;

function code(line) {
  return line.replace(/^\s*#.*$/, '');
}

export function installerViolations(source) {
  const violations = [];
  const lines = source.split('\n');

  const defaults = [...source.matchAll(/^GRAPHDONE_REF="\$\{GRAPHDONE_REF:-([^}]*)\}"$/gm)].map((m) => m[1]);
  if (defaults.length !== 1 || defaults[0] !== 'main') {
    violations.push(`GRAPHDONE_REF must be defined once with default main (found: ${defaults.join(', ') || 'none'})`);
  }

  lines.forEach((raw, index) => {
    const line = code(raw);
    const at = `${INSTALLER}:${index + 1}`;

    if (/\bgit\s+clone\b/.test(line)) {
      const branch = line.match(/(?:--branch|-b)\s+(\S+)/);
      if (!branch || !REF_VAR.test(branch[1])) violations.push(`${at}: git clone must use --branch "$GRAPHDONE_REF": ${raw.trim()}`);
      if (!/"\$\{?GITHUB_REPO_URL\}?"/.test(line)) violations.push(`${at}: git clone must use "$GITHUB_REPO_URL": ${raw.trim()}`);
    }

    const gitRef = line.match(/\bgit\s+(checkout|switch|fetch|pull)\b(.*)/);
    if (gitRef) {
      const args = gitRef[2].replace(/[|&;>].*$/, '').trim().split(/\s+/).filter(Boolean);
      for (const arg of args.filter((a) => !a.startsWith('-'))) {
        if (!REF_VAR.test(arg) && !GIT_REF_TOKENS.has(arg)) violations.push(`${at}: git ${gitRef[1]} uses a literal ref '${arg}'; use "$GRAPHDONE_REF"`);
      }
    }

    for (const m of line.matchAll(/raw\.githubusercontent\.com\/(?:GraphDone\/GraphDone-Core|\$\{?GITHUB_REPO\}?)\/([^/\s"']+)\//g)) {
      if (!REF_VAR.test(m[1])) violations.push(`${at}: raw GitHub URL pins '${m[1]}'; build it with setup_script_url`);
    }

    for (const m of line.matchAll(/\b(?:fix|feat|feature|chore|hotfix|release|bugfix)\/[A-Za-z0-9._-]+/g)) {
      violations.push(`${at}: hard-coded branch name '${m[0]}'`);
    }
  });

  const urlHelper = source.match(/^setup_script_url\(\) \{\n([\s\S]*?)\n\}/m);
  if (!urlHelper || !/"\$GITHUB_REPO" "\$GRAPHDONE_REF"/.test(urlHelper[1])) {
    violations.push('setup_script_url must build its URL from "$GITHUB_REPO" "$GRAPHDONE_REF"');
  }
  return violations;
}

export function imageTagViolations(path, text) {
  const hits = [];
  text.split('\n').forEach((raw, index) => {
    for (const m of code(raw).matchAll(/ghcr\.io\/graphdone\/[a-z0-9-]+:([^\s"'@]+)/g)) {
      if (!IMAGE_TAG.test(m[1])) hits.push(`${path}:${index + 1}: image tag '${m[1]}' is not latest or a version`);
    }
  });
  return hits;
}

function read(path) {
  return readFileSync(resolve(root, path), 'utf8');
}

function tracked(...patterns) {
  const result = spawnSync('git', ['ls-files', '--', ...patterns], { cwd: root, encoding: 'utf8' });
  assert.equal(result.status, 0, `git ls-files failed: ${result.stderr}`);
  return result.stdout.split('\n').filter(Boolean);
}

test('rules reject the deleted fix/first-start pin and accept the GRAPHDONE_REF form', () => {
  const pinned = [
    'GITHUB_BRANCH="fix/first-start"',
    'local github_url="https://raw.githubusercontent.com/${GITHUB_REPO}/${GITHUB_BRANCH}/scripts/${script_name}"',
    'git clone --progress --branch fix/first-start https://github.com/GraphDone/GraphDone-Core.git "$INSTALL_DIR"',
    'git pull origin develop',
  ].join('\n');
  const found = installerViolations(pinned).join('\n');
  for (const expected of ['default main', "pins '${GITHUB_BRANCH}'", 'git clone must use --branch', "'fix/first-start'", "literal ref 'develop'", 'setup_script_url']) {
    assert.ok(found.includes(expected), `expected a violation mentioning ${expected}:\n${found}`);
  }
  assert.equal(imageTagViolations('x', 'image: ghcr.io/graphdone/graphdone-web:fix-first-start').length, 1);

  const good = [
    'GRAPHDONE_REF="${GRAPHDONE_REF:-main}"',
    'setup_script_url() {',
    '    printf \'https://raw.githubusercontent.com/%s/%s/scripts/%s\\n\' "$GITHUB_REPO" "$GRAPHDONE_REF" "$1"',
    '}',
    'git clone --progress --branch "$GRAPHDONE_REF" "$GITHUB_REPO_URL" "$INSTALL_DIR" >"$log" 2>&1 &',
    'git fetch --quiet --tags origin "$GRAPHDONE_REF" || return 1',
    'git checkout --quiet --detach FETCH_HEAD || return 1',
    'git pull --quiet >"$update_log" 2>&1 &',
  ].join('\n');
  assert.deepEqual(installerViolations(good), []);
  assert.deepEqual(imageTagViolations('x', 'ghcr.io/graphdone/graphdone-neo4j:latest ghcr.io/graphdone/graphdone-api:v0.4.0-alpha ghcr.io/graphdone/graphdone-web:${TAG:-latest}'), []);
});

test('installer installs main by default and every ref it uses is GRAPHDONE_REF', () => {
  assert.deepEqual(installerViolations(read(INSTALLER)), []);
});

test('installer `sources` reports main and the setup-script URLs it falls back to', () => {
  const env = { ...process.env };
  delete env.GRAPHDONE_REF;
  const run = spawnSync('sh', [INSTALLER, 'sources'], { cwd: root, encoding: 'utf8', env });
  assert.equal(run.status, 0, run.stderr);
  const rows = run.stdout.trim().split('\n').map((row) => row.split(' '));
  assert.deepEqual(rows.slice(0, 2), [['repository', 'https://github.com/GraphDone/GraphDone-Core.git'], ['ref', 'main']]);
  const urls = rows.filter(([kind]) => kind === 'setup-script').map(([, url]) => url);
  assert.ok(urls.length > 0, 'no setup-script URLs reported');

  // Every setup script the installer can fetch is listed, exists in this
  // checkout (so it exists on main once this lands) and is fetched from main.
  const called = new Set([...read(INSTALLER).matchAll(/run_setup_script "([^"]+)"/g)].map((m) => m[1]));
  const listed = new Set(urls.map((url) => url.split('/').pop()));
  for (const name of called) assert.ok(listed.has(name), `run_setup_script "${name}" is not in SETUP_SCRIPTS`);
  for (const url of urls) {
    assert.match(url, /^https:\/\/raw\.githubusercontent\.com\/GraphDone\/GraphDone-Core\/main\/scripts\/setup_[a-z]+\.sh$/);
    assert.ok(existsSync(resolve(root, 'scripts', url.split('/').pop())), `${url} has no file in scripts/`);
  }

  const override = spawnSync('sh', [INSTALLER, 'sources'], { cwd: root, encoding: 'utf8', env: { ...env, GRAPHDONE_REF: 'v0.4.0-alpha' } });
  assert.equal(override.status, 0, override.stderr);
  assert.match(override.stdout, /^ref v0\.4\.0-alpha$/m);
  assert.match(override.stdout, /\/GraphDone-Core\/v0\.4\.0-alpha\/scripts\/setup_git\.sh$/m);

  const unsafe = spawnSync('sh', [INSTALLER, 'sources'], { cwd: root, encoding: 'utf8', env: { ...env, GRAPHDONE_REF: '--upload-pack=x' } });
  assert.notEqual(unsafe.status, 0, 'an option-like GRAPHDONE_REF must be rejected');
});

test('installer and compose files pull published images only by latest or a version tag', () => {
  const files = [INSTALLER, ...tracked('deployment/*.yml', 'deployment/**/*.yml')];
  const hits = files.flatMap((path) => imageTagViolations(path, read(path)));
  assert.deepEqual(hits, [], hits.join('\n'));
});

test('documented one-line install URLs serve the installer from main', () => {
  const listed = spawnSync('git', ['grep', '-nE', 'raw\\.githubusercontent\\.com/GraphDone/GraphDone-Core/[^ ]*install\\.sh', '--', '*.md'], { cwd: root, encoding: 'utf8' });
  assert.ok(listed.status === 0 || listed.status === 1, listed.stderr);
  const wrong = listed.stdout.split('\n').filter(Boolean).filter((row) => !row.includes('/GraphDone-Core/main/scripts/install.sh'));
  assert.deepEqual(wrong, [], `Install URLs must point at /main/scripts/install.sh:\n${wrong.join('\n')}`);
});
