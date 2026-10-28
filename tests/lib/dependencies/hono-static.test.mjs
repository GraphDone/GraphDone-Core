import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';

const root = new URL('../../../', import.meta.url);
const serverRequire = createRequire(new URL('packages/server/package.json', root));
const mcpRequire = createRequire(new URL('packages/mcp-server/package.json', root));
const sdkRequire = createRequire(mcpRequire.resolve('@modelcontextprotocol/sdk/server/mcp.js'));
const nodeRequire = createRequire(sdkRequire.resolve('@hono/node-server'));
const { Hono } = nodeRequire('hono');
const { serveStatic } = sdkRequire('@hono/node-server/serve-static');
const semver = serverRequire('semver');

function installedVersion(entry, name) {
  let directory = dirname(entry);
  while (dirname(directory) !== directory) {
    const path = join(directory, 'package.json');
    if (existsSync(path)) {
      const pkg = JSON.parse(readFileSync(path, 'utf8'));
      if (pkg.name === name) return pkg.version;
    }
    directory = dirname(directory);
  }
  throw new Error(`Package metadata missing for ${name}`);
}

test('locked and installed consumers exclude the affected scalar and static adapter releases', () => {
  const lock = JSON.parse(readFileSync(new URL('package-lock.json', root), 'utf8'));
  const minimums = { 'graphql-scalars': '2.0.1', '@hono/node-server': '2.1.3' };
  for (const [path, pkg] of Object.entries(lock.packages)) {
    for (const [name, minimum] of Object.entries(minimums)) {
      if (path.endsWith(`/node_modules/${name}`) || path === `node_modules/${name}`) {
        assert.ok(semver.gte(pkg.version, minimum), `${path}: ${pkg.version}`);
      }
    }
  }
  assert.ok(semver.gte(installedVersion(sdkRequire.resolve('@hono/node-server'), '@hono/node-server'), '2.1.3'));
  let scalarEntry;
  try { scalarEntry = serverRequire.resolve('graphql-scalars'); }
  catch (error) { assert.equal(error.code, 'MODULE_NOT_FOUND'); }
  if (scalarEntry) assert.ok(semver.gte(installedVersion(scalarEntry, 'graphql-scalars'), '2.0.1'));
});

test('the SDK static adapter preserves routed access checks and ordinary encoded filenames', { timeout: 5000 }, async t => {
  const directory = mkdtempSync(join(tmpdir(), 'graphdone-hono-static-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  mkdirSync(join(directory, 'assets/secure'), { recursive: true });
  writeFileSync(join(directory, 'assets/public name.txt'), 'public fixture');
  writeFileSync(join(directory, 'assets/secure/note.txt'), 'private fixture');
  const app = new Hono();
  app.use('/assets/secure/*', context => context.text('denied', 403));
  app.use('/assets/*', serveStatic({ root: directory }));
  for (const [path, status, body] of [
    ['/assets/public%20name.txt', 200, 'public fixture'],
    ['/assets/secure/note.txt', 403, 'denied'],
    ['/assets/%73ecure/note.txt', 403, 'denied'],
    ['/assets/%%37%33ecure/note.txt', 404, '404 Not Found'],
  ]) {
    const response = await app.request(path);
    assert.equal(response.status, status, path);
    assert.equal(await response.text(), body, path);
  }
  const post = await app.request('/assets/public%20name.txt', { method: 'POST' });
  assert.equal(post.status, 404);
  await post.text();
});

test('the server schema consumer supplies DateTime without an extra scalar package', async () => {
  const { Neo4jGraphQL } = serverRequire('@neo4j/graphql');
  const schema = await new Neo4jGraphQL({
    typeDefs: 'type ScalarProbe { id: ID! @id createdAt: DateTime }',
  }).getSchema();
  const scalar = schema.getType('DateTime');
  const timestamp = '2026-10-28T12:34:56.000Z';
  assert.equal(scalar.serialize(scalar.parseValue(timestamp)), timestamp);
  assert.ok(schema.getMutationType().getFields().createScalarProbes);
});
