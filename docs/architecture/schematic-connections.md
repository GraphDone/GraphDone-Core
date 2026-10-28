# Schematic connections and visual acceptance

Owner direction recorded on 2026-10-28: GraphDone should be legible like a harness or
PCB schematic, with a modern visual style. A tangled collection of curves is not
an acceptable large-graph overview. This continues the dynamic LOD plan in #219
and exact relationship inspection in #218; CodeGraph techniques remain ideas,
not a shared library or shared release dependency.

## Product rules

- Place readable groups first. Wires route around cards, their labels and the
  graph controls, with intentional ports and orthogonal lanes.
- Multiple types and parallel original links from the same source to the same
  target share a drawn branch. Branches from the same source may share a trunk;
  junction dots distinguish that intentional bus from unrelated crossings.
- Arrows follow the original source-to-target direction. A bus is display-only;
  it never invents a canonical relationship, changes a type, or implies every
  member of a group is connected to every member of another group.
- Inspect a group, its internal links, a directional bundle or an item-centered
  one/two-hop neighborhood to see exact IDs, titles and types. Parallel links,
  self-loops and unresolved endpoints remain distinct. Incoming/outgoing refers
  to stored direction, not a guessed dependency execution order.
- Dense scenes disclose connections that cannot be routed clearly. The complete
  list stays reachable. A named incoming/outgoing trace pages through connected
  groups without turning every connection back on; all outside connections stay
  counted and accessible.
- Camera movement keeps screen-space lanes and ports fixed while the cut and
  viewport remain unchanged. Source positions are sampled for placement when
  that placement changes, not rescanned for each pan event. Inspection and Back
  preserve the camera, hierarchy cut, Auto hysteresis and relationship context.

## Candidate implementation

`schematicRouting.ts` groups directed connections and searches an obstacle-aware
orthogonal grid. It refuses card intersections and contact/overlap with unrelated
buses. Shared source trunks have a reduced route cost, favoring readable fan-out.
Original edge IDs partition exactly into routed or explicitly deferred branches.
Routing has one invocation-wide attempt/state allowance, including failed
searches, plus deterministic branch/grid limits; no worker, new dependency
or graph mutation is introduced. Grid/card budgets are limits of this candidate,
not evidence of 1k/10k graph capacity.

The overview uses the router instead of its former direct cubic bundle curves.
Always-visible centroid leader lines are removed: they looked like additional
relationships and could cross labels. Source location remains available through
inspection and exact camera return. A fixed-size Connections control avoids a
feedback loop where a changing count moves labels and changes routing again.

`SemanticRelationshipBrowser` uses the canonical edge objects and adjacency
indices. Stable hierarchy selectors resolve current membership and headings when
items move or are added; a disappeared group is explicitly unavailable. Type/text filters disclose their denominator. Source inspection returns
to the relationship context; missing endpoints cannot be clicked as if loaded.
These controls still require strict real browser/database acceptance in CI.

The group browser now offers incoming and outgoing connection traces. A trace
keeps its selected group and at most five connected neighbors on a page, bounded
further by available label slots. Stable neighbor ordering makes every connected
group reachable. Paging, direction changes and live removals retain truthful
counts; a removed selected group is explicit. Incoming branches share their
actual target trunk without reversing stored source/target identities or arrows.
The current cut is held in manual Overview while tracing; item inspection and
Back retain the trace. Exiting returns to the same cut. If fewer than two slots
fit, the selected group takes priority and the complete list remains available.

Controls are measured after commit so a newly mounted trace bar is a routing
obstacle immediately. Camera pans do not rescan source positions or reroute the
unchanged trace. This remains group-level exploration; internal/item-level wires
and arbitrary selected multi-group paths still need their own implementation.

## Lightweight visual gate

Run on supported Node 22.18+ without installing a browser or starting a database:

```sh
npm run test:schematic
npm run report:schematic -- --out test-artifacts/schematic-routing
```

The tests are serial and the first four-fixture run took about 0.3 seconds locally. They
cover a chain, a fan-out bus, a dense cyclic graph, phone geometry and unplaced
endpoints. A deliberate spaghetti negative contains a card/label intersection,
unrelated crossings, overlapping wires and a diagonal segment; the gate must
reject it. Each accepted fixture must retain useful visible connections and
account for every original edge, including explicit deferred connections.

Metrics currently require zero wire-through-card intersections, zero unrelated
bus contacts/overlaps, orthogonal segments, and at most four distinct source
buses in a 48 px cell. Those are initial review thresholds, not universal layout
quality or performance claims. Input reorder must preserve the route result.
Shared-bus junctions must be visibly marked. Rendered SVG contact sheets and JSON
metrics come from the same module used by the application and are retained by CI.
The CI-only `schematic-visual` sequence also runs four headless, one-worker
fixtures with zero retries, real SVG text bounding boxes, no network requests,
and retained screenshots. It is enrolled in PR/full profiles and the Smoke Gate;
it does not start another app or database. Browser acceptance is pending until
the actual report passes.

Review the images as well as the numbers: metrics alone cannot establish pleasant
spacing, readable names or a useful hierarchy.

## Remaining work before visual completion

1. Review the actual overview at desktop/phone sizes, add long/multilingual names
   and obstacle fixtures, and test expanding a routed bus into its exact links.
2. Accept the selected-group trace in real desktop/phone CI, inspect its pictures,
   and extend it to selected item paths. Group paging alone is not full path tracing.
3. Carry organized ports/routing into item/neighborhood wiring; the existing
   item renderer still uses its previous edge geometry. Preserve drag/edit/save
   behavior and use a suitable detail budget rather than drawing every link.
4. Pass the new actual overview screenshot/DOM geometry and direction checks in
   the existing CI journeys, then measure larger fixtures there. Local full-stack and image matrices are paused
   under the owner's workstation constraint; never call skipped checks passed.
5. Reconcile reviewed nested hierarchy #216, this visual slice, import/MCP #217
   and the remaining LOD scale/loading/hosted requirements before release.

This is a reviewable candidate path. It does not close dynamic LOD, hosted parity,
release/deployment work, or the remaining item-level visual problems.

## Detailed item wiring continuation (#220)

The first item-wiring increment starts from dev
`007148f1a526b8ef028222a429b346a67e5c3c2c`. `edgeRouteGeometry.ts` defines the
shared display path, final-segment arrow, distance along the route and pointer
projection needed by the D3 path/hitbox/arrow/label consumers. Consecutive
coincident points do not produce broken paths; a nonzero closed loop retains
its travel and direction. Label placement fits an entire label on one segment,
keeps text upright, retains original icon direction and returns no placement
when no sampled slot clears cards or previous labels. This is conservative
admission, not proof that every possible position is obstructed. Equal-distance pointer hits
prefer the prior leg so dragging does not jump across a nearby return wire.

The next committed increment connects this geometry to the D3 path, hitbox,
arrow and label consumers. It still supplies straight border-to-border paths;
this does not establish routed item acceptance. Next add bounded routing and
admission, named boundary connections, exact deferred counts and accessible
original relationships. Routing and obstacle searches belong to
bounded updates after layout or scope changes, not every camera/simulation tick.
Preserve edit/Grow, pointer hitboxes, label dragging and canonical positions.

On 2026-10-28, Node22.18 ran the nine pure geometry cases serially in the existing
clean-installed partial probe: 9 passed, no skips, 0.69s (8ms test bodies).
Cases cover elbows, reversed segments, closed loops, duplicate/invalid points,
nearest-leg dragging, ties, long labels and rotated obstacle footprints. This
is scoped helper evidence, not a full-tree browser/database/performance result.

Independent foundation review also required offset-aware dragging beside close
return wires. The executed negative selected fraction100/440 instead of340/440;
matching projection to the displayed offset corrected it. All ten cases passed
serially in0.691s and scoped strict ES2020 types passed. Candidate interpolation
now stays on its current segment and keeps only the best placement, avoiding
repeated route scans/sorting. The [canonical lesson](../../.agents/inbox/2026-10-28-offset-label-drag-needs-offset-path.md)
records the negative, correction and runtime integration limits.

The D3 adaptation caches label dimensions after initial text sizing, reuses the
path for paint and hit testing, places arrows from its final segment and slides
labels along its displayed offset. Culling composes with route/label visibility
instead of revealing deferred geometry. Label dragging updates only that label
against cached obstacles. The interaction diagnostic clicks the actual path
midpoint; the center of a bent path's bounding box need not lie on the path.

Scoped web typecheck initially rejected a D3 nullable-style overload; the callback
form corrected it, and the same check passed in3.66s. Scoped lint returned
0 errors and298 warnings in the existing large renderer; no warning-free claim.
These checks used the partial probe and are not actual browser acceptance.
All original runtime/visual/durability gates and new item-wiring cases remain
required before this branch can be integrated or #220 closed.

Review of the first consumer commit (`d9a0a58`) found empty measurement of
initially hidden labels and a line-only geometry diagnostic. The correction
initializes all label parts from conservative dimensions and accepts only
positive text measurements; diagnostics now read actual SVG path endpoints.
Opposite-direction parallel edges share a canonical lane normal so they stay
separate while their arrows retain direction. Wire and label clicks open the
same original relationship editor, whose controls now have accessible names.

Two real-browser cases are registered as blocking `item-wires` acceptance in
CI immediately after smoke (one worker, zero retries), retaining actual
paint/hitbox/arrow geometry and screenshots, pointer drag/edit behavior, hidden
label dimensions and unchanged graph data. Local discovery found both cases;
they have not run locally. The partial probe passed11 geometry cases in0.722s,
32 CLI harness cases in4.56s and scoped types; scoped lint reports0 errors,
314 warnings across the two components/helper/test. The
[review lesson](../../.agents/inbox/2026-10-28-hidden-labels-need-valid-measurement.md)
records the evidence and limits. These are straight item paths preparing the
bounded routing increment, not completion of #220.


## Relationship priority with connection fallback (#220, 2026-10-28)

The owner wants a selectable relationship-priority level, while retaining at
least one connection when a pair has no relationship at that level. This is the
next bounded presentation increment after readable-symbol #222/#223; it does
not change canonical edge types, weights, source/target IDs or hierarchy.
The group-wiring #216 and item-geometry foundation #221 are accepted on dev;
full item obstacle routing and buses still remain #220.

Use two independent controls: **Detail** chooses semantic/item representation;
**Relationships** chooses the amount of relationship meaning shown. Start with
three named priority stops, with readable labels, keyboard/touch support and an
explicit current value. A manual relationship choice must persist through zoom
and inspection/Back. Do not make a tiny unlabeled slider or silently switch the
owner's chosen level as the camera moves. Auto priority may be considered later,
after the manual behavior is accepted.

Proposed initial stops are **Essential**, **Dependencies**, and **All**. Treat
type ranking as an explicit presentation policy, not a claim that business
importance can be inferred perfectly from type. Essential promotes `BLOCKS` and
`CONFLICTS_WITH`; Dependencies also includes `DEPENDS_ON`, `ENABLES`, `FOLLOWS`,
`VALIDATES` and `SATISFIES`; All includes structural/reference/general relations.
The policy needs a conservative known default for unknown imported types and
one central mapping used by item and group projections. Containment still drives
hierarchy regardless of the relationship stop. Do not reuse node priority or
edge weight without a documented semantic contract.

The fallback is **per connected endpoint pair**, not one arbitrary edge in the
whole graph. For each original pair, retain relationships admitted by the
selected level; if none qualify, retain its highest available tier. Keep ties
with distinct directions/types in the represented connection, rather than
silently dropping a cycle or deciding by incoming array order. Repeated copies
can share a presentation with a count; their original IDs remain separately
inspectable. A pair connected only by `REFERENCES` must still have a visible
representation at Essential. Deleting the last blocker must immediately reveal
the pair's dependency/reference fallback. Increasing detail must add meaning,
not unexpectedly remove already represented relationships.

Use priority to select the primary label/color of a shared branch or bus before
spending route/label budgets. For `A BLOCKS B` and `B DEPENDS_ON A`, emphasize
`A blocks B` and expose both original relations through its count/inspection.
`A BLOCKS B` and `A DEPENDS_ON B` have different implications; filtering the
latter by an explicit priority stop is not semantic deduplication. Never rewrite
its arrow or state that the records are equivalent. At All, exact types and
original directions must be available in the drawing's expanded inspection.
Opposite blocking links and self-links remain meaningful. This is pair-local
presentation reduction, not transitive reduction of a dependency graph.

At group scale, apply the pair policy before aggregation so one blocker elsewhere
between two groups cannot erase unrelated lower-tier member-pair coverage.
Then aggregate represented pairs into bounded, count-preserving buses. All
original records partition into directly represented, priority-summarized,
internal, missing-endpoint or geometry-deferred categories with non-overlapping
counts. Prefer a compact primary label and a count over multiple competing tiny
labels. Inspection reveals why a representative was chosen and every original
ID/type/direction. Missing endpoints must not masquerade as routable pairs.

The fallback guarantee is a projection invariant; finite screen space still
requires explicit geometry deferral. Do not force an illegible wire through a
card to satisfy it or claim a hidden/deferred pair is drawn. A connected pair
must remain reachable through a named bus/boundary representation or complete
inspection with truthful deferred counts. Routing should prioritize blocking
branches before contextual ones while reserving useful neighborhood coverage.

Before enabling the control, test: blocker plus reverse dependency; same-direction
non-equivalence; references-only fallback; ties/opposite directions/self-links;
unknown types; live deletion of a winner; deterministic input reorder; monotonic
level changes; group aggregation retaining every member-pair; selected-edge/edit
access; zoom/Back persistence; and unchanged API snapshots. A small headed
parallel-edge fixture should show the primary label replacing redundant visual
labels, with all original records still accessible. Extend the2000-item gate to
exercise the stops, meaningful coverage and conserved counts. Keep the existing
clutter/typography budgets and deliberate spaghetti negatives. The type-tier
mapping and control labels are proposed defaults pending visual review, not an
implemented feature or completed acceptance claim.
