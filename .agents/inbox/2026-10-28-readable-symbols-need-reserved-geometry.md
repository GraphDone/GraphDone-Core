# Readable graph symbols need one reserved geometry model

2026-10-28: the owner reported clipped relationship labels, overlaps, tiny task/feature text and wasted card space during a headed review. Issue #222 tracks the correction; #220 still owns full item routing and buses.

Evidence from an owned two-item, two-opposite-relationship fixture:
- Before correction, computed opacity was 0.707107 on both the label group and text: the effective text opacity was 0.5.
- The old card renderer used fixed type dimensions and duplicated character-count wrapping. Enlarging title glyphs at lower zoom did not reserve matching width/height.
- New focused geometry tests initially failed on exact equality of a rotated arrow coordinate (`-1.3322676295501878e-15` versus `0`). Using approximate equality for that coordinate preserves the actual geometric assertion.
- `vitest run src/lib/__tests__/graphSymbolLayout.test.ts src/lib/__tests__/edgeRouteGeometry.test.ts --maxWorkers=1`: 18 passed, 2026-10-28. Scoped web TypeScript passed after correcting D3 nullable overloads and removed transform arguments. These checks reused an owned dependency fixture, not a clean full-tree install.
- Headed inspection at approximately 0.72 zoom showed a compact card footprint 136.41 by 32.98 screen pixels with title ink inside it. This is small-fixture evidence only.

Cause: text layout, title scaling, card dimensions, route endpoints and label admission were separate decisions. Labels also ignored other wires and arrowheads, and group/child opacity compounded.

Corrective rule: measure text and reserve its displayed footprint before drawing. Cards and routes consume the same current presentation geometry; secondary rows retreat before readable primary text. Admit a complete label only when its footprint clears cards, labels, wires and arrows; expose original relationships when the drawing cannot display all labels. A small attractive fixture cannot establish large-graph acceptance: test thousands of real loaded items through zoom-out and return-to-detail, with explicit resource budgets and no viewing-induced writes.

Limits: current item paths are still straight and can cross. This checkpoint does not establish full label/UI obstacle handling, all phone/zoom interactions, bounded thousands-of-item performance, or complete schematic routing. Strict browser regressions, deliberate negative controls, CI and independent review remain required in #222. Preserve earlier failed logs and never count skipped or cancelled tests as passes.

Follow-up evidence, 2026-10-28:
- The first rendered regression sampled before the final zoom presentation transform was applied and reported undersized labels. The oracle now waits for the actual committed presentation scale and the existing opacity transition. It does not wait for arbitrary geometry violations to disappear.
- The second run classified a zero-area empty description element as a painted collision. The oracle now requires a positive painted footprint; real clipping and overlap remain failures.
- Both desktop1440 and phone390 cases then passed in22.0s with one headed Chrome, zero retries and strict fixture cleanup. Four zoom stages, keyboard compact-card editing, exact relationship access and unchanged API snapshots passed. Deliberately moving a label onto a card and shrinking a card to20px each triggered the intended oracle; restoring the DOM passed again. Retained local run directories are `item-symbols-headed1`, `item-symbols-headed2`, `item-symbols-headed3` under the owned resolution evidence directory.
- Focused geometry:19 passed. Actual unified CLI adapter/strict-evidence tests:33 passed. The added `large-symbols` sequence is headless, single-worker and zero-retry with an explicit2000-item/5000-relationship API fixture, overview clutter checks, identity/snapshot checks, detail readability and timing budgets. Discovery/enrollment is not execution; only actual CI artifacts can establish its result.

Initial checkpoint351749 CI40704807354 failed the Grow smoke visible-name assertion: `text=<name>.first()` resolved the newly added non-painted SVG `<title>` tooltip. The actual API node/edge delta had passed. The selector now explicitly requires painted `.node-title-text`; node quick-edit uses the same stricter contract. The earlier CI remains a failure; this correction requires subsequent executed smoke evidence. Comprehensive40704807565 passed and does not substitute for that gate.
