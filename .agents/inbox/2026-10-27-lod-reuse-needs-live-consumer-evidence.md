# Reuse decisions need consumer evidence as well as a passing library test

Date: 2026-10-27 UTC. Searched GraphDone's semantic/performance lessons and
CodeGraph's current unified-viewer plan before updating the LOD continuation.

The owner identified prior CodeGraph LOD work omitted from the first GraphDone
plan. Review found useful implemented behavior in the mandala and modern
continuous Structure workspace, plus a tempting standalone LOD module whose
comments describe broader sharing than its consumers establish.

## Receipt

At Graphlings source `c5fb0089f4672d1d33c4fbf6c54bef63feab2636`:

```text
node tools/codegraph/src/codegraph/assets/lib/lod.js --test
lod.js self-test: OK

rg -n 'lib/lod|window\.LOD|LOD\.(swap|band|hysteresis|labelAlpha|fadeIn)' \
  tools/codegraph/src/codegraph/assets
.../assets/lib/lod.js:72:if (typeof window !== "undefined") window.LOD = LOD;

tools/codegraph/docs/UNIFIED-VIEWER-PLAN.md:
records that lod.js has no viewer consumers and enlighten uses inline LOD

git diff --name-only -- tools/codegraph
<no paths>
```

The active inline hierarchy walk retains a parent when estimated children would
be too small; `placeLabels` prioritizes folders and collision-culls names.
`structure-workspace.js` separately maintains stable page/world identity,
bounded requests and generation checks. Those are the stronger reuse references.
Some legacy browser controls still expect mandala globals at the new Structure
front door. The installed `/api/runtime` returned 503; no live viewer pass or
performance guarantee was established in this review.

## Cause, corrective rule and limits

The first plan considered GraphDone in isolation. The follow-up also illustrates
why a file's name/header and passing pure tests do not establish runtime adoption.
Before calling code shared, trace imports and actual consumers, then verify the
behavior contract in each. Reuse observed algorithms and test invariants first;
extract a minimal common module only with two wired consumers and an appropriate
licensing boundary. Do not transfer historical FPS claims or stale test routes.

Canonical guidance: [CodeGraph reuse map](../../docs/architecture/codegraph-lod-reuse.md).
This change updates the plan and its discovery links. It copies no proprietary
source, changes no renderer, and does not claim the integration is implemented.
