# Overview wires need interaction geometry and original-edge inspection

On 2026-10-28 the owner reported that overview links could not be hovered and did not identify their endpoints. At dev `00f0211`, SemanticGraphOverview rendered bus paths under a pointer-events:none overlay and an aria-hidden SVG. A native SVG title was the only description; there was no pointer or keyboard action.

## Evidence

- In the owned headed 301-item / 370-relationship copy, the new bus target was reached by a real mouse move. It emphasized exactly two endpoint cards, exposed the directed count, and opened three original rows for the selected route. Back returned focus to the same SVG button. No original user graph was edited.
- Painted-state verification waited for two animation frames: DOM outline/stroke attributes alone did not establish that a just-updated headed screenshot had painted the emphasis.
- `npm exec --workspace=@graphdone/web -- vitest run src/lib/overviewBusHint.test.ts src/lib/semanticRelationships.test.ts src/components/SemanticGraphOverview.test.tsx`: 19 cases passed in 2.33s, including pointer/keyboard inspection, removal of the focused route or entire overview, parallel/future relationship types, and caption containment.
- The existing 301-item headed and 2,000-item / 5,000-relationship headless journeys now exercise a real pointer six pixels away from the visible line, keyboard Enter/Space, Escape dismissal, endpoint emphasis, unchanged camera, and exact directed original IDs against independently seeded group membership. Existing graph snapshot/write guards remain in place. Final-source browser evidence and hosted scale acceptance must pass before integration.

## Cause and corrective rule

A visible path is not automatically an interactive or accessible connection. Render a generous transparent stroke target separately from the visible wire, expose keyboard semantics, and use the same route identity for its label, endpoint emphasis and drill-down. Keep canonical selection and authored positions separate from transient inspection state. Preserve original edge IDs across multi-type bundles; do not silently turn a represented route into a different pair/direction query.

A hover caption is temporary but should seek free space before covering useful content. The bounded caption placement considers at most 16×16 candidates, checks all visible card/control obstacles, and clamps to the viewport. Keyboard focus returns to the original wire or a surviving group when a cut removes it. Escape dismisses the caption, and pointer transfer into it keeps it readable.

## Limits

This is the interaction slice of #220, tracked by #231. It does not solve tight overview spacing, iterative connection-aware placement, detailed wire crossings or the router's arbitrary-position grid budget. A phone with no available rectangle can still require a transient caption to cover content; keyboard/tap inspection opens the complete relationship browser. Route-count limits and honest deferred totals are unchanged. Private fixture screenshots are not published as public repository evidence.

The first updated Core browser run passed both 301-item cases in 118.22s. The final correction also checks keyboard focus when zoom removes the complete overview layer; its local/hosted acceptance is required before closeout.
