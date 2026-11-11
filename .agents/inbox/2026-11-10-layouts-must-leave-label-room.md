# Automatic layouts must leave room for every relationship label

Observed 2026-11-10 after the owner reported that "Organize around connections"
and the force layout put cards so close that relationship labels disappear. The
renderer only draws a label where the whole label clears every card, arrowhead,
other wire and earlier label (`edgeRouteLabel`); otherwise it hides it. The
layouts kept cards 64px apart (organize, hierarchical rows) or guessed label
widths (force), so most labels had nowhere to go. Earlier lessons on clearance
(`2026-10-28-clean-layout-needs-clearance-and-topology.md`) and fitting
(`2026-11-07-fit-must-measure-presented-geometry.md`) were read first; this
concerns the room between connected cards.

## Evidence

- `tests/e2e/journeys/organize-labels.spec.ts` against the unchanged `dev`
  source (3a629e2), desktop: Welcome organized 0 of 3 labels shown; Plan a
  launch organized 7 of 8 in-view labels hidden; hierarchical hid 2-33 labels per
  graph; a settled force layout from unplaced items hid 1-47 per graph (Dense
  cluster of 30: all 47). iPad and iPhone failed the same way. No label was ever
  drawn on a card or another label: the renderer hides instead, so the symptom
  is missing labels, not overlap.
- `labelClearance.test.ts` places every label as the renderer does over whole
  layouts of the same shapes on three screen sizes: the old organizer hid 2-13
  labels per shape at the zoom it frames them, the old hierarchical rows 2-47.
- Labels keep their screen size below 100% zoom, so in graph units they grow by
  1/zoom: "Organize" frames at no less than 65%, where a label needs half as
  much room again as at 100%.

## Cause and corrective rule

- Every automatic layout reserves, for each drawn edge, a visible
  (border-to-border) length of `labelGap(label, zoom)`: the measured label at the
  zoom the camera will frame the result, its clearance at both ends and the
  arrowhead. Lay out, compute the framing (`computeGraphFit` with the controls as
  obstacles, and the floor), and lay out again when that zoom needs more room.
- Reserved gaps are not enough where wires cross labels: check the result by
  placing labels exactly as the renderer does (`placeGraphLabels`) and spread
  the group by the smallest factor that frees them (`spreadForLabels`), rows
  apart first in the hierarchical layout.
- Check the layout the renderer will get, under any ids: real ids are random
  and break ties in the organizer and the label order. Keep only spreads that
  were checked, check the finished layout as a whole (`checkedWhole`), and
  test several id orders (`label room whatever the item ids`). The renderer
  starts each label from its spot in the previous frame; in a small graph,
  when a label on screen found no spot (`labelsMissed`), it retries from fresh
  spots, the placement the layouts leave room for.
- Never move a saved or organized (pinned) card to make room; after the force
  layout settles, move only the cards it placed itself (`clearFreeCards`), only
  for labels with such a card at one end, and keep a move only when it shows
  more of them. A label between two saved cards once made a new card in a
  saved graph fly 4 and then 16 times as far away; now nothing moves for it.
- Test readability with the renderer's own geometry: the browser audit reads
  every label from the DOM (turned boxes, `elementFromPoint`) and an edge whose
  cards are on screen and clear of the controls must show its label.

## Limits

The search runs in the click handler, so its work is bounded: at most
`WHOLE_FIT_MAX_CARDS` (60) cards, `LAYOUT_CHECKS` label checks and five
layouts per click (about 100 ms on a desktop; a unit test guards it). Larger
graphs keep the plain layouts and the 0.65 Organize floor (an early version
searched up to 200 cards and froze the page for seconds). A phone keeps the
0.65 Organize floor and 0.5 in the hierarchical layout: two compact cards and
a label side by side do not fit 390 px at a zoom where titles still fit whole
(below about 0.45 a long word is cut short), so a whole graph there needs
compact label chips. Above 60 cards the hierarchical rows are the old ones,
wrapped at the screen's reading width (pinned by golden numbers in
`layoutAlgorithms.test.ts`); up to 60, a row that edges leave does not wrap
(wrapped cards would sit on those edges), so a hub with many dependents is
wide. A graph of unplaced items opens organized as before. A graph's saved
arrangement is never moved, so labels hidden there stay hidden until the person
organizes. Labels under a control or the MiniMap are a camera matter, recorded
by the audit but not counted.
