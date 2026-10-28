# Freeze the index as well as runtime source during strict test runs

Date: 2026-10-28 UTC. Existing mobile touch evidence and the unified runner
already require matching source fingerprints. A layout recovery run exposed a
workflow mistake: staging the prepared implementation while the gate was active
changed the repository fingerprint even though the running renderer's bytes
were unchanged.

## Evidence

The owned run used:

```sh
TEST_URL=http://localhost:28818 QC_BROWSER_PORT=29818 xvfb-run --auto-servernum \
  node tests/run-unified.mjs --sequence layout-recovery \
  --out /tmp/graphdone-resolution-20261027/layout-recovery-strict-final
```

During execution, `git add` staged the implementation, tests and documentation.
The 2026-10-28 result was:

```text
layout-recovery: passed, 9 passed, 0 failed, 0 warned, 0 skipped (247.5s)
source-integrity: failed
The tested repository changed during this run; rerun against a stable source tree.
overall: FAILED, 9 passed, 1 failed, 0 warned, 0 skipped
```

The report remains retained. It is not counted as an accepted run. The existing
runner detected the mutation without a new implementation or weaker threshold.

## Cause and corrective rule

The source freeze includes repository/index state, not only files imported by
the running browser. Finish edits and staging, commit the candidate, then start
the exact-head gates. During a gate, keep that worktree's source, documentation,
index and runtime fixed. Read-only review and work in other owned worktrees can
continue. Wait for exit and inspect the entire report, including integrity and
execution records, before editing or crediting its case count.

## Limits

This incident establishes a provenance failure, not a failed browser behavior.
It also does not authorize ignoring source-integrity when only staging appears
to have changed. A subsequent complete, frozen-source run is required. Normal
ignored test outputs and owned external evidence remain separate from tracked
source; do not change the harness exclusions to hide an implementation mutation.
