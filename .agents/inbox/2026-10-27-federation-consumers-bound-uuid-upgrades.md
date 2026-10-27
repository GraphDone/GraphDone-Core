# Validate federation consumers before replacing their UUID dependency

On 2026-10-27, work for #186 started from dev
`ef495eff15ed7aac51e72dc7a1db1bb96d2b3695` with Node 22.18.0/npm 10.8.2.
`npm explain uuid` identified Core's direct UUID 9.0.1 and
`@neo4j/graphql@5.12.15 → @apollo/subgraph@2.14.4 →
@apollo/federation-internals@2.14.4 → uuid@9.0.1`.
Server UUID 11.1.1 and Mermaid UUID 14.0.3 were separate, already patched paths.

A bounded direct call on the baseline gave the same result for UUID v3 and v5:
a one-byte output buffer was modified and no error was thrown. The advisory
[GHSA-w5hq-g745-h8pq](https://github.com/advisories/GHSA-w5hq-g745-h8pq)
identifies 11.1.1 as patched. Inspected application calls use unbuffered v4;
federation's `src/operations.ts` uses unbuffered v1 for deferred-directive keys.
This source observation does not establish safety for future callers.

## Cause and correction

Updating subgraph to 2.15.1 removed the old federation dependency, but a real
`Neo4jGraphQL.getSubgraphSchema()` probe with a federation v2.3 `@link` failed:
`TypeError: doc.definitions is not iterable` in `concatAST`. The installed
subgraph's `modulesFromSDL` no longer normalizes Neo4j's single
`{ typeDefs, resolvers }` input. The initial probe also omitted `@link`; that
fixture error was corrected before observing this compatibility failure.

Retain subgraph/federation 2.14.4. Upgrade Core directly to UUID ^11.1.1 and
scope the transitive override to `@apollo/federation-internals@2.14.4` only.
UUID 11 retains CommonJS support; UUID 12 removes it. The existing server UUID
copy deduplicates to 11.1.1; Mermaid remains 14.0.3. No other package version
changes are part of this fix.

Adding an override and running `npm install --package-lock-only` initially left
the old root UUID resolution. The lock and buffer regression failed, exposing
that stale result. `npm update uuid --package-lock-only --legacy-peer-deps`
then `npm ci --legacy-peer-deps --no-audit --no-fund` installed 1,220 packages;
`npm ls uuid @apollo/subgraph --all` confirmed the intended consumer paths.
Do not infer the installed result from an override declaration alone.

## Evidence and limits

`node --test tests/lib/dependencies/uuid.test.mjs`: **4 passed**, covering every
locked UUID, actual consumer-relative CommonJS and ESM imports, valid generated
IDs, invalid v3/v5/v6 buffer bounds without partial writes, and real Neo4j
federation schema generation. An attempted `_service` execution without a driver
was a fixture error; schema generation/printing needs no database. Database-backed
execution remains the separate real-Neo4j contract gate.

A fresh-cache `npm audit --omit=dev --json` after the correction reported
**2 moderate router entries and 1 high Undici entry**, with no UUID/federation
finding. Undici is separately addressed by #194; this branch starts from the
older dev base. This count is dated dependency metadata, not a live exposure or
full-security claim. Complete runtime, browser and final CI results belong in
the associated PR discussion; no merge/deployment is established here.

Corrective rule: upgrade the narrowest compatible consumer chain, keep the
broken-upstream evidence, test both module systems and the actual schema API,
and verify the resolved lock and installed paths after a clean install. Revisit
the version-scoped override when federation changes; do not widen it silently.
