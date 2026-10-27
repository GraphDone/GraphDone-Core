import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import test from 'node:test';

const root = new URL('../../../', import.meta.url);
const require = createRequire(new URL('package.json', root));
const webRequire = createRequire(new URL('packages/web/package.json', root));
const tailwindRequire = createRequire(webRequire.resolve('tailwindcss'));
const nestedRequire = createRequire(tailwindRequire.resolve('postcss-nested'));
const semver = require('semver');
const patched = version => semver.valid(version) !== null && semver.satisfies(version, '>=6.1.5 <7.0.0 || >=7.1.6');

test('selector advisory guard recognizes the fixed maintained branches', () => {
  for (const version of ['6.1.4', '6.1.5-beta.0', '7.0.0', '7.1.5', '7.1.6-beta.0', 'invalid']) assert.equal(patched(version), false, version);
  for (const version of ['6.1.5', '7.1.6', '7.1.7']) assert.equal(patched(version), true, version);
});

test('every locked and actual Tailwind selector parser contains the backport', async () => {
  const lock = JSON.parse(await readFile(new URL('package-lock.json', root), 'utf8'));
  const paths = Object.entries(lock.packages).filter(([path]) => /(^|\/)node_modules\/postcss-selector-parser$/.test(path));
  assert.ok(paths.length > 0);
  for (const [path, entry] of paths) assert.ok(patched(entry.version), `${path}: ${entry.version}`);
  for (const consumer of [tailwindRequire, nestedRequire]) assert.ok(patched(consumer('postcss-selector-parser/package.json').version));
});

test('actual CSS consumers preserve flat and nested selector semantics', async () => {
  const input = '.graph:hover > .node[data-kind="task"]:is(.selected, .pending)';
  for (const consumer of [tailwindRequire, nestedRequire]) {
    const parser = consumer('postcss-selector-parser');
    assert.equal(parser().processSync(input), input);
    const flat = '.node'.repeat(2048);
    const ast = parser().astSync(flat);
    let count = 0;
    ast.walkClasses(() => count++);
    assert.equal(count, 2048);
    assert.equal(ast.toString(), flat);
  }
  const postcss = webRequire('postcss');
  const nested = tailwindRequire('postcss-nested');
  const output = await postcss([nested()]).process('.graph { & > .node { color: white; } }', { from: undefined });
  const selectors = [];
  output.root.walkRules(rule => selectors.push(rule.selector));
  assert.deepEqual(selectors, ['.graph > .node']);
});

test('installed Tailwind builds base and responsive utilities through its parser', async () => {
  const postcss = webRequire('postcss');
  const tailwind = webRequire('tailwindcss');
  const output = await postcss([tailwind({ content: [{ raw: '<div class="gap-2 text-sm md:flex"></div>', extension: 'html' }], corePlugins: { preflight: false } })])
    .process('@tailwind utilities;', { from: undefined });
  const selectors = [];
  const media = [];
  output.root.walkRules(rule => selectors.push(rule.selector));
  output.root.walkAtRules('media', rule => media.push(rule.params));
  for (const selector of ['.gap-2', '.text-sm', '.md\\:flex']) assert.ok(selectors.includes(selector), selector);
  assert.ok(media.includes('(min-width: 768px)'));
});
