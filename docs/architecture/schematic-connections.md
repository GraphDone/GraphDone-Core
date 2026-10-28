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

This foundation is not yet connected to the item renderer and does not establish
routed item acceptance. Next, adapt all four geometry consumers together, then
add bounded routing/admission, named boundary connections, exact deferred counts
and accessible original relationships. Routing and obstacle searches belong to
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
