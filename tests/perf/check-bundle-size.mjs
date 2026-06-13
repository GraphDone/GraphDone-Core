#!/usr/bin/env node
/**
 * ADAPT-8 performance budget: the web bundle must stay small enough to load
 * fast on constrained devices/networks (the adaptive-quality promise). Fails
 * CI if the largest gzipped JS chunk exceeds the budget. Run after `npm run
 * build`.
 *
 * Budget rationale: current main chunk ~372kB gzip; 450kB leaves intentional
 * headroom. Tighten as we code-split.
 */
import { gzipSync } from 'zlib';
import { readFileSync, readdirSync, existsSync } from 'fs';
import path from 'path';

const BUDGET_BYTES = 450 * 1024;
const ASSETS = path.resolve(process.cwd(), 'packages/web/dist/assets');

if (!existsSync(ASSETS)) {
  console.error(`❌ ${ASSETS} not found — run "npm run build" first.`);
  process.exit(1);
}

const jsFiles = readdirSync(ASSETS).filter((f) => f.endsWith('.js'));
if (jsFiles.length === 0) {
  console.error('❌ no JS chunks found in the web build.');
  process.exit(1);
}

let largest = { name: '', gzip: 0 };
for (const f of jsFiles) {
  const gz = gzipSync(readFileSync(path.join(ASSETS, f))).length;
  if (gz > largest.gzip) largest = { name: f, gzip: gz };
}

const kb = (b) => (b / 1024).toFixed(1) + 'kB';
console.log(`Largest gzipped JS chunk: ${largest.name} = ${kb(largest.gzip)} (budget ${kb(BUDGET_BYTES)})`);

if (largest.gzip > BUDGET_BYTES) {
  console.error(`❌ Bundle budget exceeded by ${kb(largest.gzip - BUDGET_BYTES)}. Code-split or trim deps.`);
  process.exit(1);
}
console.log('✅ Within budget.');
