# Graph unit tests must control CPU samples without disabling CPU protection

On 2026-10-23, the combined validation run failed three MCP GraphService cases with `CPU exhaustion protection activated` while the host was busy. The default tests used a mock Neo4j driver but still sampled the host's real `os.cpus()` counters. Local test mode raises the threshold to 95%; it does not remove the guard. A short burst can therefore block unrelated graph assertions.

## Reproduction and correction

A temporary Vitest setup supplied monotonically increasing CPU counters with 100% busy time to the unchanged `tests/mcp-server.test.ts`. On Node 22.23.4 this reproduced 9 failed / 8 passed cases. The first rejection can report `0.0% avg, 0.0% peak`: the existing trend formatter returns zeros until it has five samples, even though individual samples already blocked the operation. Zero trend output is not evidence that throttling did not run.

The three mock-database GraphService unit suites now import `tests/stable-cpu.ts`, which supplies deterministic idle CPU deltas. They still execute the real CPU monitor, stress check, throttling wrapper, and graph service. No production setting, environment bypass, threshold, or database-backed suite was changed. The same external busy-sample reproduction then passed all 17 original cases.

The separate `tests/cpu-monitor.test.ts` controls CPU deltas, the monitor clock, and timers. Each case explicitly selects production thresholds. Seven tests verify the 80% guard, bounded retries under sustained load, recovery within the retry budget, the operation rate window, sustained-load detection after the instantaneous load drops, GraphService rejection before opening a database session, and no replay after an operation itself fails. Timer/module state is reset between cases.

## Validation and limits

Commands used Node 22.23.4 and an isolated lockfile install:

- `npm run test --workspace=@graphdone/mcp-server -- tests/mcp-server.test.ts tests/graph-operations.test.ts tests/graph-context.test.ts tests/cpu-monitor.test.ts`: 58 passed.
- `npm run test --workspace=@graphdone/mcp-server`: 97 passed, 25 database-gated cases skipped (7 files passed, 3 skipped).
- `npm run typecheck --workspace=@graphdone/mcp-server`: passed.

The skipped cases were not counted as passes, and no shared database was accessed. These tests establish deterministic behavior under specified samples, not operating-system sampling accuracy or load-test capacity. The existing trend-message behavior and automatic CI/test-mode selection remain separate production-policy concerns.
