# Patched build and test toolchain — 2026-10-27

This is the compatible-toolchain slice of #185. Runtime-image packaging and
Turbo/Mermaid updates remain separate. This evidence does not establish image,
Windows, hosted-backend or deployment clearance.

## Versions and compatibility

| Consumer | Previous lock | Reviewed line |
| --- | --- | --- |
| Vite, declared in all four tested packages | 5.4.21 | 7.3.7 |
| React transform | 4.7.0 | 5.2.0 |
| Vitest and matching V8 coverage | 1.6.1 | 4.1.12 |
| Worker implementation | tinypool 0.8.4 | Vitest 4 native pool; tinypool removed |

Node 22.18 and 24 satisfy the installed engine/peer contracts. Vite 7 and
Vitest 4 are patched compatible lines; this change does not require adopting
Vite 8's different bundler. All locked and actually resolved copies are guarded
by `tests/lib/dependencies/toolchain.test.mjs`. The guard fails ten cases against
the old lock/install, with one compatibility control still passing.

Authoritative references:

- [Vite 7 migration](https://v7.vite.dev/guide/migration): explicit build targets
  retain ES2020, Chrome 87, Edge 88, Firefox 78 and Safari 14.
- [Vite non-Windows file boundary advisory](https://github.com/advisories/GHSA-rq7h-c2jc-7f22):
  7.3.7 is patched; network exposure and path conditions matter.
- [Vite Windows alternate-path advisory](https://github.com/advisories/GHSA-fx2h-pf6j-xcff):
  the selected line also contains its fix; this is not a Windows execution test.
- [Vitest UI advisory](https://github.com/advisories/GHSA-5xrq-8626-4rwp):
  4.1.0 and later on this line are patched; ordinary run mode does not prove UI exposure.
- [Vitest 4 migration](https://v4.vitest.dev/guide/migration): worker pool,
  test discovery and coverage behavior require explicit migration.
- [Tinypool advisory](https://github.com/advisories/GHSA-85c8-ppgw-ccpr):
  removing its actual dependency paths avoids replacing a worker major under Vitest 1.

## Preserved contracts

- Explicit `**/dist/**` exclusion prevents compiled server tests being counted
  twice. Exact discovered files match tracked sources both with and without
  compiled outputs: core 3, server 16, MCP 11, web 45.
- Coverage explicitly includes every package's source plus executable
  `packages/web/offline-shell.ts`. Unimported modules remain zero-hit entries;
  tests and compiled output are excluded. V8's new mapping changes percentages,
  so compare scope and exercised behavior rather than equating old percentages.
- MCP remains isolated forks, one worker, no parallel test files. Web/server
  use two workers; existing test deadlines and retry policy are unchanged.
- DOM matcher setup uses the Vitest entry point. Lock deduplication makes its
  augmentation resolve the same installed runner; unrelated ESLint patches and
  their placements were restored.
- The editor lifecycle fixture queries the controls' explicit accessible labels
  and still asserts native button semantics, all writes, pending refetches,
  drafts and undo snapshots. It avoids repeatedly computing roles across the
  entire dialog during the same five-second test.
- The HTTP CAPTCHA fixture searches the actual signed SHA-256 challenge using
  native hashing with the unchanged 100,000 bound. Server verification, action
  binding, replay rejection and the 20-second deadline remain unchanged. Real
  browser acceptance still uses ALTCHA's browser solver.

## Validation and retained failures

Pinned clean install, build, types and lint passed. Current Node 22 coverage
runs pass core 41, server 211, web 353 and MCP 110; the 26 explicitly opted-in
MCP database cases are not counted as passes in ordinary unit mode. The actual
owned Neo4j run passed all 136 MCP cases with the existing CI CPU-monitor mode.

Node 24 core/server/MCP coverage passed; current web coverage passed all 353
cases after correcting the fixture costs below. Final branch CI runs coverage
for both supported Node versions and remains required before integration.

The current harness passes 190/190. The real unified web adapter passes 353
with no skips or warnings. The installed runner's real pass/fail/skip JSON is
also checked through the adapter; required skips must fail.

`npm run test:toolchain` uses an owned browser/backend/build fixture and proves
React hot reload preserves state and document identity, HTTP and GraphQL
WebSocket proxy paths, denied `.env` content, a compiled offline shell that
works offline, and exclusion of API/auth responses from shell caching. It runs
as a required Smoke Gate step. The normal application, LOD, mobile and runtime
checks remain required too.

Retained failures and corrections:

1. Initial build lost DOM matcher types with nested runner installations;
   the supported matcher import and deduplicated runner fixed resolution.
2. Initial Vitest 4 discovery ran 26 compiled duplicate server cases;
   explicit dist exclusion restores source-only discovery, not fewer source tests.
3. Unbounded coverage hit the editor fixture's five-second budget. Bounded
   workers passed on Node 22, but Node 24 still exposed costly repeated role
   queries. Direct accessible-label queries preserve all lifecycle assertions;
   the corrected 18-case file and complete web suite passed with unchanged budgets.
4. Node 24 HTTP CAPTCHA coverage hit 20 seconds while using the asynchronous
   WebCrypto search loop. The independent native-hash fixture solver passed all
   four cases without changing the issued work factor or production code.
5. A local real-DB run was blocked in six cases by the host CPU monitor at
   95–100% load. The full 136-case CI-mode run passed; this proves CI parity,
   not production CPU-exhaustion behavior. The failed run is retained separately.
6. Initial dependency guards assumed a coverage-package engine field and an
   exported React-plugin manifest. Corrected guards check the actual contracts;
   they do not weaken supported-runner or version checks.

Fresh isolated-cache audit: full inventory has three residual package entries
(Turbo moderate, Mermaid/KaTeX low); production-only has zero. Historical counts
remain dated evidence, not distinct exploit counts or a claim about why registry
metadata changed. Runtime images can still contain development packages and
require the separate packaging and image inventory work in #185.

Vite's existing all-interface development binding is retained for the repo's
LAN/container workflows. Keep access within an intentionally trusted development
network or authenticated tunnel; do not expose Vite/Vitest UI/API as a public
production service. No host allowlist, credential scope or deployment is changed.
