import * as fs from 'fs';
import * as path from 'path';
import dotenv from 'dotenv';

/**
 * Loads local-only test configuration from `.env.test.local` (gitignored) into
 * process.env, without ever baking secrets or hostnames into the repo. Import
 * this for its side effect at the top of any spec/generator that needs the VLM
 * endpoints or sweep config:
 *
 *   import '../helpers/testEnv';
 *
 * Safe to import everywhere — it's a no-op when the file is absent (e.g. CI),
 * so VLM-driven suites skip cleanly. Existing process.env values win, so you
 * can still override per-run on the command line.
 */
const localEnvPath = path.resolve(process.cwd(), '.env.test.local');
if (fs.existsSync(localEnvPath)) {
  dotenv.config({ path: localEnvPath });
}

/** Comma/whitespace separated env list -> trimmed non-empty string[]. */
export function envList(name: string): string[] {
  return (process.env[name] ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Parse a comma-separated list of positive integers (sweep sizes). */
export function envIntList(name: string): number[] {
  return envList(name)
    .map((s) => Number.parseInt(s, 10))
    .filter((n) => Number.isFinite(n) && n > 0);
}

export function envNumber(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === '') return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}
