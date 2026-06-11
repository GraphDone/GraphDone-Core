# GraphDone Interaction Model — The Friction-Free Contract

> Status: accepted 2026-06-11. This is the UX constitution: every workflow is a
> state machine, every state has a visible indicator and an escape, every click
> must earn its place. Companion audit: the full friction map lives in the PR
> discussion; top items are tracked as FLOW stories in [USER_STORIES.md](../USER_STORIES.md).

## Principles (the user's best friend, not a reluctant co-worker)

1. **Predict intent.** Every button press declares what the user is trying to do
   next; the system moves them there. `+` on a node means "I want to grow the
   graph from here" → enter connect/create mode immediately, pre-wired to that
   node. Creating an item means "I'll want to name it" → the title is already
   focused for inline edit.
2. **One thing open.** Opening any overlay closes conflicting overlays
   (DialogManager exclusivity — shipped). Two competing menus on screen is a bug.
3. **Esc always works. Click-away always works.** Every mode and overlay exits
   via Escape (top-most first) and via clicking empty canvas. No keyboard traps.
4. **Modals are a last resort.** Key details (title, type, status) edit inline,
   in place, without a context switch. A modal is justified only for genuinely
   multi-field tasks, and it opens light: required fields visible, everything
   else collapsed.
5. **Every mode shows itself.** If the system is in a mode (connecting,
   multi-select, label-sliding), there is a persistent visual indicator AND the
   cursor changes. Silent modes are forbidden.
6. **Click budget.** Each core workflow has a budgeted click count, enforced by
   functional tests (`tests/e2e/flow-budgets.spec.ts`, to be written per story):
   | Workflow | Today | Budget |
   |----------|-------|--------|
   | Idea → titled node on canvas | 6–8 | **2** (quick-create + inline title) |
   | Change a title | 4 | **2** (dblclick → type → Enter) |
   | Change type/status | 4–6 | **2** (chip click → pick) |
   | Connect A→B, typed | 6–8 | **3** (+ → click B → type chip) |
   | Delete node (connected) | 6–8 | **3** (delete → single confirm w/ cascade preview) |
7. **Invariant-clean visuals.** The DOM itself is tested: exactly one line, one
   label group, one arrow per edge; label icon inside its pill; nothing renders
   twice (`tests/e2e/graph-invariants.spec.ts`).

## The unified mode machine

All canvas interaction collapses into ONE mode variable (replacing today's 11
independent flags that can contradict each other):

```
IDLE ──click node──────────▶ NODE_FOCUSED (menu/chips visible)
IDLE ──dblclick node title─▶ INLINE_EDIT (input focused; Enter=save, Esc=cancel)
IDLE ──"+" on node─────────▶ CONNECTING(source) (banner + crosshair cursor +
                              source ring; Esc/canvas-click exits)
CONNECTING ──click target──▶ EDGE_TYPED? → type chips appear AT the new edge
                              (not top-of-screen); pick or Enter accepts default
CONNECTING ──click canvas──▶ IDLE
ANY ──Esc──────────────────▶ pop one level (never trapped)
ANY ──open overlay─────────▶ previous overlay closes (DialogManager)
```

Rules encoded in a pure reducer (`lib/interactionMode.ts`, unit-tested) so the
transitions are testable without a browser. The D3 layer renders the mode; it
does not own it.

## Workstream plan (each lands as its own tested commit)

### W1 — Exits and exclusivity *(shipped: DialogManager exclusivity + global Esc)*
- Esc + canvas-click exit `isConnecting` and `editingEdge` (the two keyboard traps).
- Register every modal (Create/Connect/Delete/CreateGraph/Details) with
  `useDialog` so exclusivity + Esc + click-outside are universal.

### W2 — Inline-first editing
- Dblclick node title → in-place input (foreignObject), Enter/Esc, optimistic save.
- Type + status chips on the node card open a one-pick popover (no modal).
- After ANY create, the new node lands in INLINE_EDIT with title selected.

### W3 — Intent-predicting create & connect
- `+` on node → CONNECTING with that node as source; clicking empty canvas in
  CONNECTING offers "create new item here, connected" (the most common intent).
- Type chips appear at the midpoint of the just-created edge; Enter keeps the
  smart default (parent→child = CONTAINS, peer = RELATES_TO, by node types).
- Quick-create: `n` key / canvas dblclick → node at cursor in INLINE_EDIT (FLOW-1).

### W4 — Right-sized confirmations
- Delete node: single styled confirm with cascade preview (which edges die);
  no checkbox pairs, no modal chains. Edge delete: same styled confirm (no
  `window.confirm`).
- CreateGraph wizard: 2 steps (type+name together; template step only when
  "start from template" is chosen).

### W5 — Invariant + budget tests (the regression net)
- `graph-invariants.spec.ts`: per-edge uniqueness (line/label/arrow), label icon
  contained in pill bbox, no overlap class leaks after mode exits — run through
  REAL UI flows (connect mode, create modal), not the API.
- `flow-budgets.spec.ts`: click budgets from the table above, enforced.

## Definition of done for this model
A new user can: create, name, type, connect, retitle and complete three items
**without ever seeing a modal**, without reading docs, and without the mouse
leaving the canvas — and every step of that path is covered by a budget test.
