# Successful MCP calls do not prove a clean stdio protocol

Date: 2026-10-23. Searched the Core testing guide, MCP contract suite,
`.agents/inbox/`, and symptom index before adding this incident. The writing
procedure was read from Graphlings' `.agents/WRITING-IT-DOWN.md`; Core does not
currently carry that file.

A compiled-server probe on `b843a1b` (SDK 1.32.2, Zod 4.6.7) initialized,
listed 31 actual tools, read an owned graph, rejected malformed and unknown
calls, and successfully read again. It nevertheless failed the protocol check:
`Memory monitoring started` was written to stdout and produced a client
`SyntaxError`. The SDK reports parse errors through `client.onerror` and keeps
processing later messages, so successful tool results alone hid the defect.
The owned subprocess exited and the probe verified deletion of its one edge,
two work items and graph, in that order. No shared database was used.

The committed regression extends the existing disposable Neo4j contract. From
`packages/mcp-server`, with explicit owned loopback credentials loaded privately:

```sh
RUN_DB_CONTRACT=1 GRAPHDONE_DISPOSABLE_NEO4J=1 CI=true \
  npx vitest --run tests/neo4j-contract.test.ts -t 'actual MCP stdio'
# Before the source fix: 1 failed, 8 filtered-out cases skipped (6.67 s).
# Only valid JSON-RPC messages may appear on stdout:
#   "Memory", "CPU Monitor", "Recorded write", "Waiting for" are not valid JSON.

RUN_DB_CONTRACT=1 GRAPHDONE_DISPOSABLE_NEO4J=1 CI=true \
  npx vitest --run tests/neo4j-contract.test.ts
# After the source fix: 9 passed, 0 skipped (8.82 s).
```

The test launches the actual entry point with `node --import tsx src/index.ts`
so the existing CI contract job does not require a compiled build. It checks
initialization, real tool definitions, an owned node creation/read, independent
Neo4j readback, invalid-call rejection, continued valid use, zero stdout parse
errors through child shutdown, retained stderr diagnostics and owned-child
termination. It shares the suite's explicit disposable-DB guard. Independent
review caught that inherited cleanup swallowed failures; this fixture now uses
its own verified edge → node → graph cleanup, fails on an unconfirmed stage,
and retains the remaining ownership links. The new case creates no edges. Both
the final negative control and passing run confirmed cleanup before checking
the protocol-error channel. The implementation changes only eight operational `console.log`
calls to `console.error` in the memory, CPU and consistency utilities.

Keep stdout exclusively for MCP protocol messages. Verify both real results
and the client's protocol-error channel at this boundary. Do not silence the
errors or remove diagnostics to make the check pass.

Limits: this does not test authentication, authorization, every tool, sustained
load, forced garbage collection, or all CPU modes. The CI fixture uses the
existing CI CPU policy; production thresholds are unchanged. The installed
SDK currently maps a malformed request's schema error to `-32603` before the
more specific tools wrapper runs; this patch does not change that behavior.
Two initial standalone probe mistakes (assuming `-32602`, and comparing an
unordered Neo4j status collection without normalization) were corrected after
source inspection and retained separately from the stdout failure. The package unit run passed 97 cases with 26 explicitly DB-gated skips;
package build and typecheck passed, and lint passed with zero errors and 31
existing warnings. The full combined dependency/stdio candidate still needs
its own merged-head validation.
