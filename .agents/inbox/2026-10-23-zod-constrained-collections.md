# Validate collection limits before walking elements and retain real SDK compatibility evidence

Date: 2026-10-23. Searched the dependency/security lessons, MCP production
imports, SDK schemas and existing protocol tests. The final production audit
reported [GHSA-mrhx-c7xc-m3w5](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5)
against the locked Zod 3.25.76 package. The advisory lists versions below 4.6.6
as affected and 4.6.6 as patched. Its later audit appearance does not establish
when the vulnerability became reachable or why earlier audit responses differed.

The [upstream fix, PR #6652](https://github.com/colinhacks/zod/pull/6652), rejects
oversized collections before parsing their elements when a leading upper-size
check applies. Later refinements do not run after that rejection. Unbounded
containers are unchanged. The regression exercises that narrow contract with
three-element collections, eight invalid array elements and one 101-element
SDK completion response, not an exhaustion-sized input or timing threshold.

Baseline evidence on clean dependency base
`78a90cc7899e44c33aa27117bccb19ea7cbe85f6`, Node 22.23.4, Zod 3.25.76 and MCP
SDK 1.32.2:

```text
npm ci --legacy-peer-deps --no-audit --no-fund
added 1222 packages; exit 0

npm run test -w @graphdone/mcp-server -- tests/zod-sdk-compatibility.test.ts
13 cases: 5 failed, 8 passed; exit 1
array/set/map upper bounds: 3 element/key refinement calls, expected 0
array length 2 with 8 invalid elements: 9 issues, expected one too_big issue
SDK completion maximum 100 with 101 invalid values: 102 issues, expected one
```

The final-fixture failing-before log is retained in the owned regression worktree at
`test-artifacts/audit-20261023/zod-sdk-baseline-final.log`; the initial run remains
in `zod-sdk-baseline.log` in the same directory. Install output is retained
as `/tmp/graphdone-zod-baseline-install.log`. The test is
[`packages/mcp-server/tests/zod-sdk-compatibility.test.ts`](../../packages/mcp-server/tests/zod-sdk-compatibility.test.ts).
Patched-dependency results must be recorded separately before this test patch
is merged with the dependency correction.

No GraphDone application source imports Zod directly. The MCP SDK already uses
`zod/v4` from the 3.25.76 package for the low-level `Server` and stdio schemas;
it accepts either Zod 3.25 or 4. The regression's in-memory SDK client/server
checks initialization, tool listing, nested arguments and metadata, absent
arguments, default result content, malformed calls, invalid results and later
recovery. A small stdio buffer checks invalid-envelope rejection, next-message
parsing and the configured byte cap. These fixture handlers do not start the
GraphDone entry point or prove GraphService/Neo4j behavior.

Core registers `tools/list` and `tools/call`, not completion. The constrained
completion schema is an SDK regression surface, not proof of a reachable Core
completion endpoint. Tool argument declarations remain JSON schemas; upgrading
Zod does not make the low-level server enforce every declared tool constraint
or apply its JSON-schema defaults. Current tool results use an unbounded
content array, and the SDK's stdio byte cap is not a general allocation bound.

Corrective rule: pair dependency-audit remediation with a small failing-before
behavior test and real consumer compatibility checks. Preserve accepted input,
default and failure behavior without relying on complete error-message text.
Do not describe this bounded-collection correction as complete request-resource
protection, a deployed fix, or a new authentication/data-isolation guarantee.
