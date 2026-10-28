# A tool's nonzero exit is not proof that its task failed correctly

Date: 2026-10-27. Issue #185. Existing dependency lessons cover actual consumers
and runner evidence; no indexed lesson distinguished a CLI parsing failure from
an executed task's failure during a major build-tool migration.

## Evidence

The first Turbo 2 contract combined `--cache=local:rw` and `--force`. The tool
returned `the argument '--cache' cannot be used with '--force'` before executing
the intended failing task. `remaining-tooling-contract-cli-negative.log` retains
this failure. The draft assertion rejected it; it is not acceptance evidence.

The corrected contract selects local write-only cache mode for the negative
case, then requires the real child's unique `owned-core-failure-23` marker,
nonzero runner status and no dependent execution. It also proves dependency
ordering, environment passthrough and cache invalidation/reuse. Installed Turbo,
Mermaid/KaTeX and Vite contracts pass 3/3 on Node 22.18 and 24.22.1.

Separately, old installed KaTeX 0.16.47 fails an inert inherited-trust expression
that the patched consumer rejects. Lock inventory alone would not demonstrate
that behavior. The browser test resolves Mermaid from its actual declaring
workspace, including when npm places it outside root `node_modules`.

## Cause and corrective rule

Major tools can change CLI semantics, task configuration, environment filtering,
dependency placement and rendering defaults. Verify the installed consumers and
their observable outputs. Require evidence that the intended failure boundary
was actually reached; an arbitrary nonzero process exit is insufficient. Keep
compatibility choices explicit and retain unsuccessful draft evidence.

## Limits

These are owned local consumer checks, not production exposure or exploitability
claims. No remote cache login, registry publication or deployment is performed.
The [migration record](../../docs/quality/REMAINING_TOOLING_2026-10-27.md) records
exact versions, primary sources, dated audits and remaining acceptance gates.
