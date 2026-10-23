import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { isAbsolute, join, relative } from 'node:path';

export function sourceState(root, output) {
  const git = args => execFileSync('git', args, { cwd: root, maxBuffer: 64 * 1024 * 1024 });
  const revision = git(['rev-parse', 'HEAD']).toString().trim();
  const diff = git(['diff', '--binary', 'HEAD', '--', '.']);
  const files = git(['ls-files', '--others', '--exclude-standard', '-z']).toString().split('\0').filter(Boolean).filter(file => {
    const path = relative(output, join(root, file));
    return isAbsolute(path) || path === '..' || path.startsWith('../') || path.startsWith('..\\');
  }).sort();
  const hash = createHash('sha256').update(revision).update('\0').update(diff);
  for (const file of files) hash.update('\0').update(file).update('\0').update(readFileSync(join(root, file)));
  return { revision, dirty: diff.length > 0 || files.length > 0, fingerprint: hash.digest('hex') };
}
