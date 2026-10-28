import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, realpathSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';

assert.equal(process.env.NODE_ENV, 'production');
const root = process.env.GRAPHDONE_IMAGE_ROOT || '/app';
const forbidden = /^(?:vite|vitest|vite-node|tinypool|esbuild|typescript|tsx|prettier|turbo|node-gyp|playwright|playwright-core)$|^(?:eslint(?:$|-)|@vitest\/|@vitejs\/|@playwright\/|@esbuild\/)/;
const packages = [];
const visited = new Set();
function inspect(directory) {
  const actual = realpathSync(directory);
  if (visited.has(actual)) return;
  visited.add(actual);
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isSymbolicLink()) continue;
    if (entry.isDirectory()) inspect(path);
    else if (entry.name === 'package.json') {
      const value = JSON.parse(readFileSync(path, 'utf8'));
      if (value.name && path.includes('/node_modules/')) packages.push({ name: value.name, version: value.version, path });
    }
  }
}
inspect(join(root, 'node_modules'));
for (const name of ['core', 'server', 'mcp-server']) {
  const directory = join(root, 'packages', name);
  if (existsSync(join(directory, 'node_modules'))) inspect(join(directory, 'node_modules'));
}
assert.deepEqual(packages.filter(item => forbidden.test(item.name)), [], 'Runtime contains unused build/test packages');
for (const name of ['core', 'server', 'mcp-server']) {
  const directory = join(root, 'packages', name);
  assert.ok(existsSync(join(directory, 'dist/index.js')), `Missing compiled ${name} entry`);
  for (const entry of readdirSync(join(directory, 'dist'), { recursive: true })) assert.equal(/\.(test|spec)\./.test(entry), false, `Compiled test remains in ${name}`);
  assert.equal(existsSync(join(directory, 'src')), false, `Unexpected ${name} source tree`);
  assert.equal(existsSync(join(directory, 'tests')), false, `Unexpected ${name} test tree`);
  const manifest = JSON.parse(readFileSync(join(directory, 'package.json'), 'utf8'));
  const require = createRequire(join(directory, 'package.json'));
  for (const dependency of Object.keys(manifest.dependencies || {})) {
    if (dependency === '@modelcontextprotocol/sdk') {
      for (const subpath of ['server/index.js', 'server/stdio.js', 'types.js']) require.resolve(`${dependency}/${subpath}`);
    } else require.resolve(dependency.startsWith('@types/') ? `${dependency}/package.json` : dependency);
  }
}
assert.equal(process.getuid(), Number(process.env.GRAPHDONE_EXPECTED_UID));
for (const path of ['/usr/local/lib/node_modules/npm', '/usr/local/lib/node_modules/corepack', '/usr/local/bin/npm', '/usr/local/bin/npx', '/usr/local/bin/yarn', '/usr/local/bin/corepack']) assert.equal(existsSync(path), false, `Unexpected global tool ${path}`);
const rootRequire = createRequire(join(root, 'package.json'));
for (const dependency of Object.keys(JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).dependencies || {})) rootRequire.resolve(dependency);
const require = createRequire(join(root, 'packages/server/package.json'));
const sqlite = require('sqlite3');
const database = await new Promise((resolve, reject) => {
  const opened = new sqlite.Database(':memory:', error => error ? reject(error) : resolve(opened));
});
await new Promise((resolve, reject) => database.get('SELECT 7 AS value', (error, row) => error ? reject(error) : row.value === 7 ? resolve() : reject(new Error('Native SQLite result mismatch'))));
await new Promise((resolve, reject) => database.close(error => error ? reject(error) : resolve()));
console.log(JSON.stringify({ node: process.version, installedPackages: packages.sort((a, b) => a.path.localeCompare(b.path)), nativeSQLite: 'passed' }));
