import { existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';

export function parseOptions(args, profiles, sequences) {
  const options = { profile: 'smoke', out: 'test-artifacts/unified', open: false };
  const names = new Map([['--profile', 'profile'], ['--sequence', 'sequence'], ['--out', 'out'], ['--cloud-findings', 'cloudFindings']]);
  const seen = new Set();
  for (let i = 0; i < args.length; i++) {
    const flag = args[i];
    if (seen.has(flag)) throw new Error(`Duplicate option: ${flag}`);
    seen.add(flag);
    if (flag === '--open') { options.open = true; continue; }
    const key = names.get(flag);
    if (!key) throw new Error(`Unknown option: ${flag}`);
    const value = args[++i];
    if (!value || value.startsWith('--')) throw new Error(`Missing value for ${flag}`);
    options[key] = value;
  }
  if (!Object.hasOwn(profiles, options.profile)) throw new Error(`Unknown profile: ${options.profile}`);
  options.ids = options.sequence ? [options.sequence] : profiles[options.profile];
  for (const id of options.ids) {
    if (!Object.hasOwn(sequences, id)) throw new Error(`Unknown sequence: ${id}`);
    if (!['vitest', 'playwright', 'cloud-audit'].includes(sequences[id].adapter)) throw new Error(`Unknown adapter for sequence: ${id}`);
  }
  return options;
}

function canonicalPath(path) {
  let parent = resolve(path);
  const suffix = [];
  while (!existsSync(parent)) {
    suffix.unshift(relative(dirname(parent), parent));
    parent = dirname(parent);
  }
  return join(realpathSync(parent), ...suffix);
}

function contains(parent, child) {
  const path = relative(parent, child);
  return path === '' || (!isAbsolute(path) && path !== '..' && !path.startsWith(`..${process.platform === 'win32' ? '\\' : '/'}`));
}

function rejectSymlinks(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    const stat = lstatSync(path);
    if (stat.isSymbolicLink()) throw new Error(`Report output contains a symbolic link: ${path}`);
    if (stat.isDirectory()) rejectSymlinks(path);
  }
}

export function prepareOutput(output, repository) {
  const dir = canonicalPath(output);
  const root = realpathSync(repository);
  const metadata = ['--git-dir', '--git-common-dir'].map(flag => canonicalPath(resolve(root, execFileSync('git', ['rev-parse', flag], { cwd: root, encoding: 'utf8' }).trim())));
  if (contains(dir, root) || contains(join(root, '.git'), dir) || metadata.some(path => contains(path, dir))) throw new Error('Report output must not be the repository, its ancestor, or Git metadata.');
  const marker = join(dir, '.graphdone-unified-output');
  if (existsSync(dir)) {
    if (!lstatSync(dir).isDirectory()) throw new Error('Report output must be a directory.');
    rejectSymlinks(dir);
    const names = readdirSync(dir);
    let owned = false;
    try { owned = readFileSync(marker, 'utf8') === 'graphdone.unified-output/1\n'; } catch {}
    if (!owned && names.every(name => ['report.json', 'report.html', 'sequences', 'assets'].includes(name))) {
      try {
        const report = JSON.parse(readFileSync(join(dir, 'report.json'), 'utf8'));
        owned = report.schema === 'graphdone.unified-report/1' && Array.isArray(report.sequences);
      } catch {}
    }
    if (names.length && !owned) throw new Error('Refusing nonempty output directory that is not owned by the unified harness.');
  }
  mkdirSync(dir, { recursive: true });
  writeFileSync(marker, 'graphdone.unified-output/1\n');
  return dir;
}
