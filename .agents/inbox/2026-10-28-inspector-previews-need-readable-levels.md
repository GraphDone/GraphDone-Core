# Compact inspectors need readable content and read-only gestures

Date: 2026-10-28. Issue225 follows the accepted shared typography work in223.
Existing readable-symbol, preview-style, control-flow and priority-context
lessons were searched first.

## Evidence and cause

The active `NodeInspector` still used a markdown renderer with inline code at
0.85em and fenced code at0.7/0.8rem. A focused phone browser case using the
unchanged a531823 `NodeContentRenderer.tsx` failed in30.39s: actual inline code
was11.9px, fenced code12.8px, both weight500. Other preview/caller files were
from the current candidate; this is an exact old-renderer reproduction, not a
claim that the entire old checkout ran the new test.

Command: `playwright test tests/e2e/graph/inspector-readability.spec.ts
--grep390 --project=GraphDone-Core/dev-neo4j/chromium --headed --workers=1
--retries=0 --trace=retain-on-failure --reporter=json`, using owned local fixtures.
The old nested preview also used6px SVG labels, truncated names to18characters,
and could draw600 thin straight lines. Its300-item/600-edge fetch caps were
not distinguished from total graph counts.

The first corrected desktop/phone run passed the phone but failed desktop
no-write acceptance. Trace requests showed two `UpdateWorkItems` calls writing
the same owned parent position(-300,-300), before opening the child graph.
The D3 drag lifecycle starts on an ordinary node click and unconditionally queued
positions at end, even without movement. The requests were blocked and retained;
unchanged API data alone would have missed this defect.

After delaying node pinning/reheating until actual drag movement, both journeys
passed in35.57s, with301/564 and72/132 actual child items/edges,14px/500 floors
in normal/compact/preview text and zero writes/errors. This intermediate green
run was visually insufficient: markdown's long cell squeezed another table
column into single letters, and the desktop minimap covered the inspector's
bottom. The final candidate reserves a real table column width with horizontal
scrolling and bounds the docked inspector above a shown minimap. Existing
actual drag/recovery acceptance passed in13.06s. The final focused run passed
both inspector journeys in37.97s; all four screenshots were inspected. Seven
pure/component cases passed in1.90s. The final preview query includes either
endpoint in the child graph so incoming boundary connections are retained as
pending context. Same-named representative items are deduplicated only in the
visible examples; underlying membership/counts are unchanged.

The component oracle initially counted two decorative Lucide icon lines as
old diagram wires; it now distinguishes aria-hidden icons from diagram content.
The first type check also rejected `replaceAll` under this repository's target;
use the compatible global replacement without changing the toolchain.

Independent review found another untested boundary at cfd7c24: a long parent
title was wrapped in a non-scrolling header. A DOM-only408-character probe in
the owned graph copy produced a498px inspector with840px header, tabs below its
bottom and a zero-height body. The real phone regression then failed in13.32s:
title height336px exceeded the96px limit. The correction bounds the full title
in a keyboard-scrollable region and lets the whole panel scroll; header/tabs/body
cannot shrink the contents to zero. Desktop/phone regression now includes long
parent titles, keyboard access to the full text and a560px-high window. The
first attempted negative accidentally reused the previous short-title spec due
to a same-source/destination copy; its14.37s green result is not negative proof.
Only the subsequently copied long-title spec and retained failing trace count.
The first corrected run still failed phone short-window visibility (88.76% of the
code block, below the90% oracle). The harness now awaits End/Home scrolling to
finish and explicitly centers code after resize. A second run passed that check
but could not find Expand: resize had legitimately selected compact item detail.
The journey now uses a real wheel gesture to restore full detail before Expand;
it does not mutate the D3 transform or relax the visibility requirement.
Final desktop/phone passed2/2 in39.20s, with both inspector variants,560px window,
zero writes/errors and eight file-backed artifacts. All six PNGs were inspected.
The existing smoke gate passed6/6 in116.87s on cfd7c24; final complete CI must
validate the correction as well. Stored child counts are handed to the existing
portable-authoring issue217 with source evidence; do not silently fix fixture
properties to conceal that remaining writer-contract limitation.

## Corrective rule

Compact mode may change spacing and heading hierarchy, but must keep working
text at least14px/500. Render fenced code in one semantic pre/code block with
horizontal scrolling, useful line height and readable comments. Tables must
preserve usable column widths; scroll within the inspector rather than squeezing
words to single characters or widening the entire panel.

At thumbnail scale, present bounded semantic groups, full representative names
and typed/directed grouped connection counts. Preserve every original in the
underlying partition, including parallel/reverse/self links and missing
endpoints. Distinguish capped data and unavailable/loading relationships from
known totals or zero. An Open graph action reaches the complete graph.
The preview is a structured summary, not a scaled copy of authored positions.

Opening or inspecting a node is not a drag. Do not pin/reheat on pointer-down
alone or enqueue a position just because a drag-end event fired. Only accepted
changed positions update the locally authoritative snapshot. Keep ordinary
real drag, durable receipts, account/graph ownership and recovery behavior.

## Regression and limits

Pure/component cases cover conservation, stable bounded sampling, unknown types,
long multilingual names, loading/errors/empty states, limits and navigation.
The real desktop/phone journey covers normal and compact code, an injected
8px/400 negative, long-line scrolling, table widths, minimap clearance, a dense
nested preview, partial counts and opening the complete child graph. It records
actual typography JSON/PNGs as files for the unified new-user sequence, guards
mutations before navigation, and compares API snapshots.

The nested fixture must connect both the denormalized `subgraphId` and actual
`subgraph` relation: setting only the ID produced a misleading zero-count parent
sheet in the intermediate screenshot. The fixture uses the supported GraphQL connect input. A follow-up fixture run
failed because the new required target variable was omitted; correcting that
variable yielded two passing journeys in37.97s. The parent card still shows the
server's stored zero counts: Graph.nodeCount/edgeCount are defaulted properties,
not live aggregates. Connecting the graph alone does not repair these counts.
The inspector preview derives counts from its actual fetched data. Do not claim
this fixture correction fixes stored count maintenance or portable import/MCP
semantics (issue217).

Main item obstacle routing, route/minimap clearance and larger rendering/loading
budgets remain220/193. Full relevant CI, exact-source independent review, actual
artifact inspection and post-dev acceptance remain required. Keep the failed
and visually rejected runs; a green assertion set alone is not visual acceptance.
