# Display projections need explicit renderer ownership and real selection checks

Date: 2026-10-27. Repository: GraphDone-Core. Base: current dev
`ef495eff15ed7aac51e72dc7a1db1bb96d2b3695`. Related implementation:
`semanticLOD.ts`, `SemanticGraphOverview.tsx`, `InteractiveGraphVisualization.tsx`.
Existing guidance searched: symptom index, performance-evidence index, the live
graph write-attempt lesson and the snapshot-merge lesson.

## Evidence and cause

The first nine projection/placement tests passed, but independent review found
that a sibling summary overlay bypassed the existing SVG's native gestures and
overlapped Workspace controls. Moving it inside the retained SVG fixed gesture
ownership, but exposed a second boundary: descendant `svg.select('defs')` could
select React's nested definitions instead of the source renderer's definitions.
Source children also override inherited visibility/pointer-events, so hiding only
their parent with those properties did not reliably disable source hit targets.

The second headed browser run used an owned Neo4j fixture, 301 pinned items and
370 relationships, at widths 1440 and 390:

```text
TEST_URL=http://127.0.0.1:28528 QC_BROWSER_PORT=28529 xvfb-run --auto-servernum \
  npx playwright test tests/e2e/graph/semantic-lod.spec.ts \
  --project=GraphDone-Core/dev-neo4j/chromium --headed --workers=1 --reporter=line
2 failed: getByTestId('node-inspector') expected visible; element(s) not found
```

The item camera moved, but the member click removed its browser section before
the document outside-click handler inspected the target. A `closest()` exclusion
alone failed because the target's detached subtree no longer reached the overview
root. Stop click propagation at the React overview boundary, while allowing native
camera gestures to reach the owning SVG. The third run passed both viewports,
including inspector selection, Back, wheel, zero attempted writes and exact saved
position readback before/after navigation and reload.

Earlier validation failures are retained in ignored
`test-artifacts/lod-evidence/first-attempt/` and `second-attempt/`. The first run
also had fixture confounders: a concurrent typecheck rebuilt Core and restarted
the watched API; 100-input Neo4j create mutations exceeded the test timeout.
Use the built API without a watcher and repeated 20-input mutation shapes for
this fixture. Keep the full 301/370 dataset. The default parallel web unit run
had a 16ms timing assertion fail and a 5s UI timeout; a one-worker run passed all
335 tests. Do not run timing-sensitive validation alongside heavy fixture work.

## Corrective rule

- Keep source and projected objects separate; projected coordinates never enter
  simulation merges or the save queue.
- Give React and D3 explicit sibling roots. Scope D3 definition selection to
  direct children and preserve the React root during initialization.
- Hide source groups with `display:none` while the overview owns interaction;
  refresh text fitting once they become measurable again.
- Exercise ordinary pointer, keyboard and touch navigation through the actual
  production component. Assert the inspector and focus, not only camera motion
  or a `data-active` flag. Check forced Overview at normal item scale too.
- Bind Back state to an inspection session, including graph changes, and retain
  exact typed/directed edge accounting even when some labels cannot fit.

## Limits

These are local owned-fixture results, not evidence of deployment or Cloud parity.
This slice retains the full source SVG and full graph queries. It does not resolve
legacy autosave of newly placed/overlapping nodes, nested spatial cuts, streaming,
or the 1k/10k performance targets. A local note is not published knowledge until
the related reviewed change is integrated.
