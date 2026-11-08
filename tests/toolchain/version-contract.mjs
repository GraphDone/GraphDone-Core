import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

// Every place that carries the release version, with the exact text that must
// hold it. The release workflow refuses a tag whose manifests differ; this
// contract also keeps the runtime-reported versions (web, MCP, server log,
// installer fallback, local image tags, README badge) from going stale.
// scripts/update-version-minimal.sh updates all of them.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const read = path => readFileSync(resolve(root, path), 'utf8');
const version = JSON.parse(read('package.json')).version;

export const LOCATIONS = [
  ['packages/web/src/utils/version.ts', v => `APP_VERSION = '${v}'`],
  ['packages/web/.env.example', v => `VITE_APP_VERSION=${v}`],
  ['packages/mcp-server/src/index.ts', v => `version: '${v}'`],
  ['packages/mcp-server/src/health-server.ts', v => `version: '${v}'`],
  ['packages/mcp-server/tests/health-server.test.ts', v => `toBe('${v}')`],
  ['packages/mcp-server/tests/neo4j-contract.test.ts', v => `version: '${v}'`],
  ['packages/server/src/index.ts', v => `GraphDone Server v${v} starting`],
  ['scripts/install.sh', v => `GRAPHDONE_VERSION="v${v}"`],
  ['deployment/docker-compose.yml', v => `gd-core-api:${v}`],
  ['deployment/docker-compose.yml', v => `gd-core-web:${v}`],
  ['deployment/docker-compose.http.yml', v => `gd-core-api:${v}`],
  ['deployment/docker-compose.http.yml', v => `gd-core-web:${v}`],
  ['README.md', v => `badge/version-${v.replaceAll('-', '--')}-`],
];

test('every workspace manifest and the lockfile carry the root version', () => {
  for (const dir of readdirSync(resolve(root, 'packages'))) {
    const file = `packages/${dir}/package.json`;
    if (existsSync(resolve(root, file))) assert.equal(JSON.parse(read(file)).version, version, file);
  }
  const lock = JSON.parse(read('package-lock.json'));
  assert.equal(lock.version, version, 'package-lock.json');
  assert.equal(lock.packages[''].version, version, 'package-lock.json packages[""]');
  for (const [path, entry] of Object.entries(lock.packages)) {
    if (/^packages\/[^/]+$/.test(path)) assert.equal(entry.version, version, `package-lock.json ${path}`);
  }
});

test('runtime-reported versions, image tags and the badge carry the root version', () => {
  const stale = LOCATIONS.filter(([path, expected]) => !read(path).includes(expected(version)))
    .map(([path, expected]) => `${path}: expected "${expected(version)}"`);
  assert.deepEqual(stale, []);
});
