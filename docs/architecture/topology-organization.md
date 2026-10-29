# Organize by connections and leave room to read

Owner feedback on2026-10-28: overview remains crowded despite readable labels and working hover; detailed mode remains a junk pile. A dominant hub should occupy the center of its neighbors, with circular arrangements where the graph calls for them. This implementation is tracked by #233, complements detailed routing #220 and does not establish complete LOD acceptance by itself.

## Spatial contract

Use actual card sizes. Reserve at least64px between overview columns and64px between rows, and at least20px of routing clearance around unrelated cards. Wire lanes from unrelated buses must have a measurable separation, not just avoid exact intersections. Keep a complete relationship browser and explicit deferred counts; passing by hiding all useful routes is forbidden. Phone layouts keep readable cards and fewer representatives, not scaled-down text.

## Topology and bounded refinement

Compute undirected connectivity for placement while retaining every original directed relationship for rendering/inspection. Parallel or redundant types cannot multiply a node's centrality. Split disconnected components. A dominant connected hub occupies the center; its neighbors occupy angular sectors around it. Chains and cycles follow their own ordered path/ring. Deeper networks use bounded radial breadth levels with related branches adjacent, with radii derived from measured dimensions and spacing. Pack components without overlap. Use deterministic IDs/ties and bounded iterative ordering, report work, and avoid all-pairs force work on every animation tick.

Overview admits readable representatives through its existing hierarchy/parent fallback and full lists, then iteratively improves slot assignment using its actual represented relationships. Preserve a central slot for a clear hub where space permits. Camera gestures and hover retain accepted positions.

Detailed organization uses the existing explicit organize/save lifecycle. Saved layouts stay authoritative on load. A genuinely unplaced scene can use the topology organizer initially; adding items must not reposition every existing item. The original localhost graph is not a test fixture.

## Validation and limits

Keep small deterministic hub, chain, cycle, disconnected, long-card and phone cases; reject a deliberately crowded negative. Inspect real browser screenshots and geometry from the app, including exact connection coverage, card/wire clearance, endpoint identity, edits, saved reload and unchanged camera during inspection. Extend the existing2,000-item/5,000-relationship hosted gate; larger capacity and hosted parity remain separate.

CodeGraph's circle packing, per-region admission, parent fallback and stable renderer/camera identity inform these choices. GraphDone's rectangular cards, directed task relationships and saved layouts need an independent implementation; no shared library or CodeGraph change. The existing orthogonal overview router is a useful bounded reference. Detailed item routing around arbitrary cards remains #220 and cannot be claimed solved by radial placement alone.

The existing one-time `separateCards` repair remains an exception for already overlapping saved coordinates: it can move those cards and save the repair on load. This predates the topology organizer. Already-clear saved arrangements remain unchanged until an explicit organization action. The original localhost graph is not a fixture.

Organization retains every simulation item even when only a viewport subset is painted. It explicitly exits the legacy dependency-row mode, including delayed callbacks. The camera keeps the selected component's hub horizontally centered, first keeps the focused hub clear of controls, then ranks complete visible cards before other control overlap, and uses a readable zoom floor for the central neighborhood. Small phone hubs choose from bounded angle/aspect candidates using measured rectangular clearance, so a five-item system keeps all five cards readable. Larger neighborhoods may require panning; explicit Zoom to fit remains available. Camera framing examines at most32 nearby cards and16 vertical candidates. Save-status transitions are separate from final acknowledged-save screenshot acceptance; transient/error overlays are not claimed solved here.

Final small-scene visuals require every card and title actually painted, at least12px of screen/control margin, complete short words, full nine/five-card desktop/phone containment, central hub, exact saved positions and settled camera restoration. A correct bounding box during an entrance fade is not visual acceptance. Normal transient save progress is excluded from permanent organized framing; attention/error panels remain obstacles. Explicit organization stops the initial camera-framing loop.
