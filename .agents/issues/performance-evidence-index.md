# Performance evidence symptoms

| Symptom | Lesson and regression |
| --- | --- |
| A completed visual capture reports attempted writes, or a fit graph has zero readable identities | [Live review write attempts](../inbox/2026-10-27-live-graph-review-can-attempt-layout-writes.md); [semantic LOD acceptance](../../docs/architecture/dynamic-graph-lod.md) |
| Partial loading is designed around complete-snapshot merge helpers | [Snapshot replacement is not page append](../inbox/2026-10-27-snapshot-merges-are-not-page-appends.md) |
| Performance gate skips empty graphs, missing metrics, or times failed requests; mobile CI passes skipped required cases | [Required gates need owned measured evidence](../inbox/2026-10-23-performance-gate-evidence.md); `tests/lib/perf/*.test.mjs`, `tests/lib/runner/unified-cli.test.mjs`, `tests/perf/graph-perf.spec.ts` |
| A placed graph renders but `window.__graphPerf` is absent, stale, or belongs to a previous graph | [First and terminal measurements must publish](../inbox/2026-10-23-performance-gate-evidence.md); the three-case required performance gate |
