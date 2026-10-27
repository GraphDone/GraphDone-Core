# Sharing LOD techniques between CodeGraph and GraphDone

Reviewed 2026-10-27 following the owner's direction to reuse prior CodeGraph work.
This supplements the [dynamic LOD delivery plan](dynamic-graph-lod.md). The first
implementation should start from the mechanisms and regression contracts below,
rather than inventing another zoom policy or loading lifecycle.

## Source and evidence boundary

CodeGraph lives in `Valpatel/graphlings/tools/codegraph`. Reviewed remote dev and
local HEAD: `c5fb0089f4672d1d33c4fbf6c54bef63feab2636`. The local Graphlings tree
has unrelated changes; `git diff --name-only -- tools/codegraph` returned no
paths. Those changes were left intact. Source links below pin this revision.

The newer default Structure workspace is the strongest model for continuous
hierarchical loading. The legacy mandala still contains useful LOD/label/card
logic. They are different renderers; do not combine their claims into an
imaginary already-shared engine.

`node tools/codegraph/src/codegraph/assets/lib/lod.js --test` returned
`lod.js self-test: OK`. However, source searches found no current viewer import
of that module. The server can serve it, but the mandala uses its own inline
`LOD` settings and functions. The [unified viewer plan][viewer-plan] explicitly
records this wiring gap. A passing pure self-test does not prove viewer use.

The installed service's `/api/runtime` returned HTTP 503 during this review.
No live CodeGraph usability/performance pass is claimed. Browser tests below
were inspected, not executed. Some legacy LOD tests still navigate `/` or
`/#structure` while expecting mandala globals; the default route now hosts the
continuous workspace. Port their invariants with correct routes and fixtures,
not their selectors or historical pass counts.

## Reuse map

| Existing technique and source | GraphDone application | Adaptation required |
| --- | --- | --- |
| **Projected-size hierarchy walk** in [mandala `enlighten.html`][mandala], around `walk`, `childRk` and `drawDirNode` | LOD-1/2: retain a named parent until its children can actually appear. Decide locally per group, not solely from global zoom or total node count. | The circle-pack estimate `parent radius / sqrt(child count)` is specific to that geometry. For GraphDone cards/pinned layouts, measure projected child bounds and label occupancy. Never expand into an unreadable or unloaded empty region. |
| **Parent-first collision-aware labels**, `placeLabels` and `labelAlphaFor` in [mandala][mandala] | LOD-3: keep navigation identities readable, then admit item names according to available space. | GraphDone adds focus/search/blocker priorities, measured text bounds, panel obstacles and stable tie-breaking. Retain its proposed 14px group / 12px item floors; CodeGraph's 10px/9px floors and 600-label cap are not suitable defaults to copy. |
| **Separate enter/exit thresholds and bounded rich cards** in [mandala][mandala] | LOD-3: avoid flickering representations; limit expensive detail panels while keeping ordinary compact items accessible. | Existing card thresholds are 80/58 projected radius, max four transient cards, with selection work on a 180ms cadence. Reuse the state-machine/cost separation, not those exact values. Camera motion stays frame-synchronous; expensive detail admission can be coalesced. |
| **Pure fade/band/swap/hysteresis functions** in [`lib/lod.js`][lod] | Candidate common primitive for transition math and contract tests across both apps. | It is not currently wired into viewers. Extract/adapt live behavior first and compare outputs before wiring; opacity conservation alone does not ensure readable labels or correct pointer ownership. |
| **Stable world coordinates while pages arrive**, `layoutChild`/`acceptTree` in [Structure workspace][structure] | LOD-1/7: append data without moving already-visible anchors; keep graph identity separate from page state. | CodeGraph assigns a child slot using stable index and total before all pages arrive. GraphDone must preserve authored positions and semantic group anchors; do not re-tile the user's saved graph or mistake unloaded items for deletions. |
| **Bounded, coalesced, cancellable loading**, `enqueueTree`/`pump`/`lazyLoad` in [Structure workspace][structure] | LOD-7, with the contract established in LOD-1: load visible detail only, cancel obsolete scope, reject stale results. | CodeGraph uses 100-entry pages, two requests, a 140ms lazy-load delay, AbortControllers, scope/project epochs and response-generation tokens. Bind GraphDone jobs to owner + graph + revision + grouping/filter lens; keep unloaded-edge endpoints pending. |
| **One retained renderer/camera**, `worldAt`/`screen`, pointer gestures, visibility messages and `requestDraw` in [Structure workspace][structure] | LOD-2/3: overview→subsystem→item remains one spatial world; preserve pointer anchor and camera on mode return; pause hidden work. | Keep GraphDone's existing D3 camera/inspector integration initially. Do not transplant the CodeGraph shell, iframe routing or filesystem UI. Canvas plus accessible DOM targets is a reference if profiling later warrants a hybrid renderer. |
| **Generation-bound identity and explicit incomplete coverage** in [repository views][views] and Structure `subject`/inventory handling | LOD-1/7/8: distinguish missing data, partial results, stale data and actual deletion; do not show a different graph under the selected label. | A CodeGraph token binds an indexed commit/capture, not GraphDone authorization. Preserve account/ACL boundaries before aggregates and adapt to mutable graph revisions. Offset pages are safe only under an equivalent stable-snapshot contract. |
| **Seeded topology grouping with fallback** in [navigator `_detect_communities`][navigator] | LOD-5: a concrete starting experiment for suggested grouping when explicit containment/metadata is absent. | CodeGraph uses weighted Louvain on an undirected view, resolution 0.5 and seed 42, with connected-component fallback. These code-graph weights/parameters are not a universal system ontology. Evaluate GraphDone fixtures, stabilize group IDs across updates and preserve original directed/typed edges independently. |

GraphDone's existing `graphAdjacency`, `edgeLOD`, `graphDataMerge`, quality governor,
camera and save queue remain foundations. CodeGraph's directory tree does not
provide GraphDone's full arbitrary-graph projection: multiple membership,
conflicting containment, exact typed/directed bundles, filters and edit recovery
still need GraphDone-specific contracts.

## Regression techniques worth sharing first

The strongest immediate transfer is the test intent, before any runtime package:

| CodeGraph control | GraphDone counterpart |
| --- | --- |
| [`test_lod_descent_no_dead_zone.py`][no-dead-zone] | Sample intermediate zoom steps in both directions; require a readable group/item representation and navigable context at each sample. Strengthen “something drawn” to meaningful semantic coverage. |
| [`test_folder_label_lod_climb.py`][label-climb] | Dense views may cull names, but continued zoom must eventually reveal each requested group/item. Use a discriminating intermediate density, not a sparse endpoint that passes despite a broken label budget. |
| `test_lod_all_files_load.py` and `test_lod_dense_folder_all_files_load.py` | Every member remains reachable on descent, including dense groups and unusual entity types. Assert exact membership, not just a nonzero rendered count. |
| [`test_portfolio_view.py::test_structure_directory_paging_adds_nodes_without_moving_existing_world`][portfolio-tests] | Hold the next page, capture existing IDs/world coordinates, release it, assert new nodes append while prior anchors stay fixed. Include pending endpoints and explicit deletions. |
| `test_structure_wheel_pan_and_fit_keep_one_canvas`, real multitouch and mode-return controls in [portfolio tests][portfolio-tests] | Check actual wheel/pinch/pan, renderer identity, zoom anchor and camera restoration. A URL change or screenshot count does not establish continuous navigation. |
| Late-source/foreign-generation/unavailable-inventory controls in [portfolio tests][portfolio-tests] | A delayed response cannot replace a newer graph, selected item or account. Failed/incomplete inventory retains honest context; it does not become an empty graph or confirmed removal. |

Run these in GraphDone's existing Playwright/Vitest/report stack using owned
synthetic fixtures. Keep CodeGraph's Python/browser harness in its repo. Shared
fixture data and invariant definitions can have adapters for both harnesses;
there is no need to import one application's entire test infrastructure.

## Sharing boundary and delivery order

1. **LOD-0: use these regression contracts now.** Add dense-child visibility,
   label self-resolution, stable-page geometry and camera-identity checks to the
   first fixture plan. Record the CodeGraph source revision for each borrowed
   technique. Correct routes before reusing a legacy browser control.
2. **LOD-1/2: adapt the actual hierarchy walk and source registry.** Implement
   GraphDone's pure cut/projection boundary using parent fallback and stable
   anchors. Define page accumulation/epochs early, even while the first slice
   still receives a complete graph. This avoids rewriting the boundary in LOD-7.
3. **LOD-3: consolidate genuinely common primitives.** Candidates are projected
   size bands, hysteresis state, label ordering/box collision and camera transform
   math. A small renderer-neutral JavaScript/TypeScript interface can consume
   geometry/intent and return decisions; it should know nothing about React,
   D3, Neo4j, filesystem paths or repository tokens. Supply policy/budgets through
   adapters. Use behavior-comparison tests against the live inline implementation
   before replacing it. Do not call it shared until both consumers are wired.
4. **LOD-7: adapt the modern request lifecycle.** Keep browser request scheduling
   reusable in concept; application-specific transport/auth/response validation
   stays in each adapter. Add GraphDone's mutable-data and pending-edge semantics
   rather than copying CodeGraph's immutable directory API.
5. **Then evaluate a common package.** Require two real consumers, attribution,
   versioned interface, tests and packaging without service dependencies. Reusing
   techniques and contracts is useful immediately; a new package is not a
   prerequisite for delivering the first GraphDone overview.

CodeGraph's package declares `LicenseRef-Valpatel-Proprietary`; GraphDone-Core
is MIT. This review copies no implementation into Core and publishes nothing.
Any source extraction into a distributed shared package or public Core needs an
explicit licensing choice; technique reuse and project-specific implementation
can proceed without silently relicensing private source.

Useful return flow to CodeGraph: GraphDone's exact typed-edge accounting,
partial-count semantics, selection through aggregation, graph edit protection,
and generic hierarchy-conflict tests should become cross-project contract cases.
That would improve both products rather than leave two unrelated LOD forks.

## Current related CodeGraph work

Checked on GitHub during this review:

- [#2764](https://github.com/Valpatel/graphlings/issues/2764), all-project zoom and
  usable graph panels, remains open; the continuous Structure implementation
  landed via [#2802](https://github.com/Valpatel/graphlings/pull/2802). Source
  presence and an open umbrella issue are different evidence.
- [#2803](https://github.com/Valpatel/graphlings/issues/2803), retained local work
  in the same world, remains open. Current source/docs contain local-provider
  handling; do not infer deployed coverage or closeout from that alone.
- [#2808](https://github.com/Valpatel/graphlings/issues/2808) records an oversized
  edge target making a whole Cosmos projection unavailable, including affected
  GraphDone repos. Carry the lesson into GraphDone: bounded partial projection
  must disclose omitted edges without truncating identifiers or inventing links.

The immediate recommendation is to borrow **parent fallback, progressive label
resolution, stable camera/world identity and generation-bound loading**, with
their tests. Keep GraphDone's domain semantics and existing renderer integration.

[mandala]: https://github.com/Valpatel/graphlings/blob/c5fb0089f4672d1d33c4fbf6c54bef63feab2636/tools/codegraph/src/codegraph/assets/enlighten.html
[lod]: https://github.com/Valpatel/graphlings/blob/c5fb0089f4672d1d33c4fbf6c54bef63feab2636/tools/codegraph/src/codegraph/assets/lib/lod.js
[structure]: https://github.com/Valpatel/graphlings/blob/c5fb0089f4672d1d33c4fbf6c54bef63feab2636/tools/codegraph/src/codegraph/assets/lib/structure-workspace.js
[navigator]: https://github.com/Valpatel/graphlings/blob/c5fb0089f4672d1d33c4fbf6c54bef63feab2636/tools/codegraph/src/codegraph/navigator.py
[views]: https://github.com/Valpatel/graphlings/blob/c5fb0089f4672d1d33c4fbf6c54bef63feab2636/tools/codegraph/docs/REPOSITORY-VIEWS.md
[viewer-plan]: https://github.com/Valpatel/graphlings/blob/c5fb0089f4672d1d33c4fbf6c54bef63feab2636/tools/codegraph/docs/UNIFIED-VIEWER-PLAN.md
[no-dead-zone]: https://github.com/Valpatel/graphlings/blob/c5fb0089f4672d1d33c4fbf6c54bef63feab2636/tools/codegraph/tests/visual/test_lod_descent_no_dead_zone.py
[label-climb]: https://github.com/Valpatel/graphlings/blob/c5fb0089f4672d1d33c4fbf6c54bef63feab2636/tools/codegraph/tests/visual/test_folder_label_lod_climb.py
[portfolio-tests]: https://github.com/Valpatel/graphlings/blob/c5fb0089f4672d1d33c4fbf6c54bef63feab2636/tools/codegraph/tests/visual/test_portfolio_view.py
