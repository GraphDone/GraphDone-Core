# Toolchain upgrades must preserve discovery, coverage and consumer behavior

Date: 2026-10-27. Issue #185; source based on reviewed auth stack `d83fd9a`.
Searches of the symptom/security indices found dependency-scope and consumer
lessons but no current Vite/Vitest migration procedure.

## Evidence

The initial Vite 7.3.7 / Vitest 4.1.12 build failed DOM matcher types. A nested
runner layout prevented the matcher augmentation resolving its consumer. The
supported Vitest matcher import and deduplication fixed the build. Unrelated
lint patch drift was restored rather than accepted as part of the upgrade.

`npm run test` initially reported 237 server cases rather than 211: Vitest 4
also discovered the built copies of 26 source tests. The explicit dist exclusion
restored exactly the tracked source file set. Discovery with and without build
outputs is identical: core 3, server 16, MCP 11, web 45. Coverage explicitly keeps
unimported source and the executable offline-shell plugin at zero hits.

Node 22 and 24 coverage exposed expensive editor queries and asynchronous test
proof solving. The five-second editor and 20-second CAPTCHA deadlines were
retained. Direct accessible-label queries preserve all editor assertions; a
native SHA-256 search still solves the actual signed 100,000-bound challenge.
A local CPU-protected database run failed six cases on the busy host; a separate
CI-equivalent run passed all 136, without claiming production CPU acceptance.
All earlier failures remain under the dated evidence directory on the test host.

Current harness: 190/190; actual unified web adapter: 353/353. An owned browser
contract exercises real HMR/state, HTTP/WebSocket proxying, secret denial and
compiled offline loading. Supported-Node coverage is a required CI matrix check.
See [the migration evidence and limits](../../docs/quality/TOOLCHAIN_MIGRATION_2026-10-27.md)
for commands, versions, authoritative references and remaining work.

## Cause and corrective rule

A successful install or lower audit count does not preserve runner behavior.
Upgrade runner, coverage, transformer and Vite as compatible consumers. Compare
actual source discovery, inspect zero-hit coverage, exercise real reporter output
through the strict harness, and test worker/database and browser behavior. Never
count compiled duplicates, skipped required cases or earlier failed attempts as
passes. Do not replace timeouts with retries to mask migration failures.

## Limits

This is a toolchain slice, not runtime-image security clearance. Turbo and
Mermaid/KaTeX remain separately scoped; image packaging/scanning, hosted acceptance,
main promotion and deployment are unfinished. Native browser/database checks
used owned Linux fixtures. Final exact-head review and CI remain required.
