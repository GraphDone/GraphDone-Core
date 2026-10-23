# Validate collection limits before walking elements and retain real SDK compatibility evidence

Date: 2026-10-23. Searched the dependency/security lessons, MCP production
imports, SDK schemas and existing protocol tests. The final production audit
reported [GHSA-mrhx-c7xc-m3w5](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5)
against the locked Zod 3.25.76 package. The advisory lists versions below 4.6.6
as affected and 4.6.6 as patched. Its later audit appearance does not establish
when the vulnerability became reachable or why earlier audit responses differed.

The public advisory was published October 1 and reviewed/updated October 23;
it was not newly published when the final check failed. On unchanged
`78a90cc7899e44c33aa27117bccb19ea7cbe85f6`, the fresh production audit exited 1
with eight moderate findings and this one high finding, while the earlier CI
response contained eight moderate findings only. Repeating with CI's npm
10.9.9 also reported the high finding. The exact registry/cache/backend cause
of the differing responses is unproven. The CI audit step now uses its own
runner-temporary cache for each run attempt, retaining the existing install
cache and unchanged high/critical threshold. This removes restored audit-cache
reuse as one variable; it does not guarantee registry freshness.

The direct MCP dependency is pinned to 4.6.7. A manifest-only install initially
left the vulnerable 3.25.76 copy hoisted for the SDK and nested the new version
under MCP. A targeted `npm update zod --package-lock-only --ignore-scripts
--legacy-peer-deps` resolved the single root copy instead. The final lock delta
changes only that root version, its registry integrity, and the MCP constraint;
SDK 1.32.2 stays unchanged. `npm ls zod --all --omit=dev` confirms both the SDK
and zod-to-json-schema deduplicate to 4.6.7. Do not equate the manifest pin alone
with remediation of the consumer's resolved dependency.

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
After cherry-picking the separate manifest/lock correction
`b843a1baef4b5de1efbca3cd73c1a0346806afff` onto the regression branch, the
combined local head was `8d206e2cd2698082ee71d709cd86a3d3d0d7fc58`. A fresh
`npm ci --legacy-peer-deps --no-audit --no-fund` installed Zod 4.6.7 with unchanged
SDK 1.32.2. The same command and unchanged test file then passed **13/13**,
zero failures/skips, exit 0 in 441ms. All five previously failing bounded cases
passed; the eight SDK compatibility/control cases stayed passing. Logs are
`zod-patched-install.log` and `zod-sdk-patched.log` beside the retained baseline.
No production audit or complete application result is inferred from this
focused run.

No GraphDone application source imports Zod directly. The MCP SDK already uses
`zod/v4` from the 3.25.76 package for the low-level `Server` and stdio schemas;
it accepts either Zod 3.25 or 4. The regression's in-memory SDK client/server
checks initialization, tool listing, nested arguments and metadata, absent
arguments, default result content, malformed calls, invalid results and later
recovery. A small stdio buffer checks invalid-envelope rejection, next-message
parsing and the configured byte cap. These fixture handlers do not start the
GraphDone entry point or prove GraphService/Neo4j behavior.

Malformed call parameters reject before fixture dispatch. The SDK's existing
low-level parse path maps these schema failures to an MCP error; the tests do
not require a specific message or claim every request error is `InvalidParams`.
Invalid handler results do use `InvalidParams`, and the next valid result still
succeeds. Schema/default compatibility here does not establish every SDK API.

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

The combined candidate `df1fac165a5f1421602c3706db8b86090b54a4f5` subsequently
passed all 603 unit cases (26 gated skips), 161 harness cases and nine real
Neo4j/entry-point contract cases with the separate stderr-diagnostic correction.
Its compiled production-mode MCP probe recorded zero protocol errors and
verified owned child/data cleanup. The fresh-cache production audit exited 0
with eight moderate findings and no high/critical finding. The consolidated
[validation ledger](../../docs/quality/CORE_VALIDATION_2026-10-23.md#follow-up-the-fresh-production-audit-held-final-approval)
keeps this combined evidence separate from the focused SDK fixture and from
pending final public CI/review.
