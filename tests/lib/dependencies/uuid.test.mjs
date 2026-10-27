import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import test from 'node:test';

const root = new URL('../../../', import.meta.url);
const require = createRequire(new URL('package.json', root));
const coreRequire = createRequire(new URL('packages/core/package.json', root));
const federationRequire = createRequire(require.resolve('@apollo/federation-internals'));

test('every locked UUID path has the buffered-output fix', async () => {
  const lock = JSON.parse(await readFile(new URL('package-lock.json', root), 'utf8'));
  const paths = Object.entries(lock.packages).filter(([path]) => /(^|\/)node_modules\/uuid$/.test(path));
  assert.ok(paths.length > 0);
  for (const [path, entry] of paths) {
    assert.ok(require('semver').gte(entry.version, '11.1.1'), `${path}: ${entry.version}`);
  }
});

test('Core CommonJS and ESM consumers generate valid unbuffered UUIDs', () => {
  const cjs = coreRequire('uuid');
  const ids = Array.from({ length: 100 }, () => cjs.v4());
  assert.equal(new Set(ids).size, ids.length);
  for (const id of ids) {
    assert.ok(cjs.validate(id));
    assert.equal(cjs.version(id), 4);
  }
  const esm = spawnSync(process.execPath, ['--input-type=module', '-e', `
    import assert from 'node:assert/strict';
    import { v4, validate, version } from 'uuid';
    const id = v4();
    assert.ok(validate(id));
    assert.equal(version(id), 4);
  `], { cwd: new URL('packages/core/', root), encoding: 'utf8', timeout: 5000 });
  assert.equal(esm.error, undefined);
  assert.equal(esm.status, 0, esm.stderr);
  const federation = federationRequire('uuid');
  assert.equal(federation.version(federation.v1()), 1);
});

test('Core and federation UUID reject invalid buffers without partially writing', () => {
  for (const consumer of [coreRequire, federationRequire]) {
    const uuid = consumer('uuid');
    for (const name of ['v3', 'v5', 'v6']) {
      for (const [length, offset] of [[1, 0], [16, 1], [16, -1]]) {
        const buffer = new Uint8Array(length).fill(42);
        const original = buffer.slice();
        const args = name === 'v6' ? [{}, buffer, offset] : ['graphdone', uuid[name].DNS, buffer, offset];
        assert.throws(() => uuid[name](...args), RangeError, `${name}: length=${length} offset=${offset}`);
        assert.deepEqual(buffer, original);
      }
    }
  }
});

test('Neo4j builds its federation schema through the installed Apollo consumer', async () => {
  const { Neo4jGraphQL } = require('@neo4j/graphql');
  const { printSubgraphSchema } = require('@apollo/subgraph');
  const neo = new Neo4jGraphQL({ typeDefs: `
    extend schema @link(url: "https://specs.apollo.dev/federation/v2.3", import: ["@key"])
    type WorkItem @key(fields: "id") { id: ID! @id title: String! }
  ` });
  const schema = await neo.getSubgraphSchema();
  const sdl = printSubgraphSchema(schema);
  assert.match(sdl, /type WorkItem\b/);
  assert.match(sdl, /@key\(fields: "id"\)/);
  assert.ok(schema.getQueryType().getFields()._service);
  assert.ok(schema.getQueryType().getFields()._entities);
});
