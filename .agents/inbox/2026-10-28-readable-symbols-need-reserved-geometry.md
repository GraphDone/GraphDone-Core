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
