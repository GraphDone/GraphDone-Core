# Fresh advisories require consumer evidence even when application code is unchanged

Date: 2026-10-28. Searched the security symptom index and existing dependency-scope,
backport and installed-consumer lessons. Issue227 is the bounded follow-up to
PR226's required audit failure; the UI correction is tracked separately in225.

## Evidence and cause

`gh run view 40784339385 --repo GraphDone/GraphDone-Core --log-failed` reported
one high graphql-scalars finding and one moderate @hono/node-server finding,
while the previous bcf source's audit had passed. Both advisories were added to
GitHub's database on2026-10-28. This does not mean this PR introduced the code.

- [GHSA-x8rm-f576-gq67](https://github.com/advisories/GHSA-x8rm-f576-gq67)
  describes PhoneNumber regular-expression denial of service. The locked
  graphql-scalars1.24.2 was a direct server dependency with no source import,
  no other incoming lock dependency and no declared PhoneNumber schema use.
  Remove that unused dependency. Do not upgrade an unused package across a
  major solely to clear an audit. The actual Neo4j schema supplies its DateTime
  scalar without it; this is separately exercised after removal.
- [GHSA-rmxm-3fg6-px4f](https://github.com/advisories/GHSA-rmxm-3fg6-px4f)
  affects the installed MCP SDK's node-server2.1.1 adapter. The SDK's existing
  range admits the fixed2.1.x line. A targeted lock update resolves2.1.5;
  upstream2.1.3 fixes double decoding,2.1.4 admits Hono5 peers and2.1.5 fixes
  HTTP/2 cancellation and restricts static serving to GET/HEAD. The installed
  Hono4 and supported Node22/24 contracts remain in range. No override is added.

`npm update @hono/node-server --package-lock-only --ignore-scripts --no-audit`
also normalized unrelated peer/dev flags. Those unrelated entries were restored;
an executable before/after comparison found exactly three changed lock entries:
node_modules/@hono/node-server, removal of node_modules/graphql-scalars, and the
server workspace's removed dependency. No other resolved package changed.

## Corrective rule and executed regression

Inspect the consumer's actual module resolution, not only the top-level version.
The new dependency control resolves the Hono adapter through the installed MCP
SDK and sends requests through its static middleware using owned temporary files.
An ordinary encoded-space filename remains readable, explicit protected paths
remain denied, and the malformed second-decode path cannot expose the fixture.
The original2.1.1 fixture fails with200 instead of404; the corrected2.1.5 fixture
passes. POST cannot return the static file. No production service is probed.

Local commands on2026-10-28:

- Node22 `npm ci --ignore-scripts --no-audit --no-fund`: successful in the owned
  dependency worktree. Native install hooks are deliberately not covered locally.
- `npm audit --omit=dev --json --cache <new-owned-cache>`: zero findings in every
  severity, with the corrected lock. This is production scope at that audit time.
- `node --test --test-concurrency=1 tests/lib/dependencies/hono-static.test.mjs`:
  corrected3/3 passed in0.684s. Old installed/locked fixture:2fail/1pass in0.718s;
  both the version guard and actual malformed-path request discriminated it.
- `npm ls graphql-scalars @hono/node-server --all`: only SDK1.32.2 →
  @hono/node-server2.1.5 remained; no graphql-scalars copy was installed.

## Limits

The protected-file control is an isolated dependency contract, not proof that
GraphDone exposes static private files through Hono. No reachable PhoneNumber
field or deployed exploit was established. The existing server schema, real
Neo4j/MCP and all runtime image gates still must pass on the final composition.
A local install with skipped hooks does not prove native runtime packaging.
Keep this failed audit and subsequent exact-source results attached to227;
close only after reviewed dev integration and actual post-dev acceptance.
