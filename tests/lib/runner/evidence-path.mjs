import { lstatSync, realpathSync } from 'node:fs';
import { isAbsolute, join, relative, resolve, sep } from 'node:path';

export function ownedEvidencePath(root, value) {
  if (typeof value !== 'string' || !value) throw new Error('File evidence needs a source path.');
  const directory = resolve(root, 'test-artifacts');
  const source = resolve(root, value);
  const inside = relative(directory, source);
  if (!inside || inside === '..' || inside.startsWith(`..${sep}`) || isAbsolute(inside)) {
    throw new Error('File evidence must be inside the repository test-artifacts directory.');
  }
  let cursor = directory;
  let stat;
  for (const part of ['', ...inside.split(sep)]) {
    cursor = join(cursor, part);
    stat = lstatSync(cursor);
    if (stat.isSymbolicLink()) throw new Error('File evidence must not traverse symbolic links.');
  }
  if (!stat?.isFile()) throw new Error('File evidence must be a regular file.');
  const canonical = realpathSync(source);
  const canonicalInside = relative(realpathSync(directory), canonical);
  if (!canonicalInside || canonicalInside === '..' || canonicalInside.startsWith(`..${sep}`) || isAbsolute(canonicalInside)) {
    throw new Error('File evidence escaped its canonical artifact directory.');
  }
  return canonical;
}
