import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Machine-parsable output: one report.json (schema graphdone.unified-report/1)
 * plus per-sequence raw JSON under sequences/ for CI artifact upload / debugging.
 * Returns the paths written.
 */
export function writeJsonReport(report, outDir) {
  mkdirSync(join(outDir, 'sequences'), { recursive: true });
  const mainPath = join(outDir, 'report.json');
  writeFileSync(mainPath, JSON.stringify(report, null, 2));
  const seqPaths = [];
  for (const seq of report.sequences || []) {
    const p = join(outDir, 'sequences', `${seq.id || 'sequence'}.json`);
    writeFileSync(p, JSON.stringify(seq, null, 2));
    seqPaths.push(p);
  }
  return { mainPath, seqPaths };
}
