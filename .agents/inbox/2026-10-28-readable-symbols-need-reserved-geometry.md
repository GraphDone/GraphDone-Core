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


Independent review and executed scale evidence, 2026-10-28:
- PR223 review5684569576 identified an unreachable0.08 test zoom (the real minimap clamps at0.1), unbounded failed label placement attempts, culled labels consuming visible slots/counts, and lost Browse return focus. All four are corrected in the next checkpoint. Pure regression fixtures exercise2000 failed candidates, a total collision-check cutoff and2000 hidden candidates preceding one visible label. The production placement helper has32 labels,128 attempts and200000 obstacle/segment checks as invocation-wide limits; partial checks never admit a label.
- Exact e4 CI40706957761 actually loaded2000 items and5000 edges and passed the eight-group overview clutter/accounting checks. Its first return-to-detail took5847ms against the5000ms gate and failed; the failure screenshot showed zero admitted labels. This remains a failure, not scale acceptance. Corrective work filters placement candidates/obstacles to the visible drawing, prevents hidden labels consuming slots, reuses presentation for unchanged items and rebuilds card content only for uncullled items. The old middle zoom target was not reached in this failed run.
- CI timing JSON now uses retained file attachments, including the timing before a failing budget assertion. The unchanged five-second budget and minimum visible-content assertions must pass in a subsequent actual run; they were not relaxed.
- Complete local headed smoke:6 passed in2.0min (single worker, zero retries). Corrected focus/placement desktop+phone cases:2 passed in22.0s, including Browse Back/Escape focus and compact-editor focus return. Geometry/budget cases:22 passed. Relationship UI cases:14 passed; an initial pagination regression exceeded5s because global accessibility queries scanned1250 buttons, then navigation-scoped queries passed without increasing the timeout.
- Exact relationship access renders at most250 rows per page, with full-result search and explicit original counts. This bounds the new5000-edge browse path; pagination itself does not prove the complete large browser journey.


The owner's follow-up rejects tiny type and plain boxes as the visual direction. The revised contract raises full item/overview titles to18px, compact title and edge-label floors to14px, and graph controls to readable14–16px type. Overview cards reserve240x96px; controls reserve their actual two-line height. Subtle layered fills and a restrained teal heading accent distinguish groups. CSS letter spacing on item type text is neutralized so canvas measurement matches displayed header width.

The6d81752 CI40709921026 large case still failed first zoom at6807ms under the original runner-wall-clock measurement. Its trace shows the timed region included Playwright selector/attribute calls with substantial durations that mix application waiting and protocol/snapshot work; the trace does not isolate those costs (`call867`180338–180836ms, `call869`181294–185485ms, then separate state assertions). The corrected test records both wall time and an in-browser request-to-two-settled-animation-frame duration, with the same5000ms browser budget. This changes the measured boundary and must not be represented as the old wall-time check passing or as a proven performance gain. Both prior failures remain evidence.

Independent review5684764521 also reproduced stale compact cards exposed during a held pan. Visibility reconciliation now applies current item geometry before exposing each newly visible card, bounded to changed nodes; the large gate includes a held-pan/reveal assertion. Browse focus restoration now preserves an unrelated control focused before the scheduled return.54 relevant geometry/hierarchy/relationship unit cases passed after the typography/layout change; strict final browser and CI acceptance remain required.

Revised18px/14px typography passed both focused headed desktop/phone cases in23.5s, one worker and zero retries, with strict cleanup and the same deliberate clipping/overlap controls. Scoped web TypeScript passed. This does not replace the pending final large-graph, hierarchy, phone and workflow CI artifacts.

Independent review5685069307 found the in-browser timer could finish while the parent CSS still hid item layers: child `data-active=false` precedes the passive parent update. The timer now requires the parent gate, actually visible bounded cards and readable titles/labels (or visible overview summaries) for two frames. A deliberate1200ms visibility mask must be included in the measured interval. Hidden overview layout/routing is skipped; projection/accounting remains available and a focused test requires fresh summaries after a hidden live update and return. These changes require subsequent executed validation; neither state attributes nor revised timing alone prove scale acceptance.

Exact5d CI40713075178 passed the small item consumer/symbol cases but failed the2000-item case on zero visible labels. Its retained timing was3709ms browser/5011ms wall and its overview accounting/clutter passed; this is not full scale acceptance, and the timer at that revision had the review gap above. The route search sampled whole-segment midpoint/end positions, missing the visible middle slice of a long connection. Label candidate ranges now intersect the viewport reduced by the full rotated label footprint, then use the same bounded samples/collision checks; a10000-unit route regression covers this case.24 scoped route/overview cases and web TypeScript passed. Both updated headed desktop/phone cases passed in23.3s, including the deliberate1200ms visibility delay, after correcting the shared timing helper to allow small graphs without an overview layer. The initial negative-control run failed on that missing optional layer; its trace is retained. All local probes still reuse owned dependencies.

Independent review5685328335 confirmed the content-aware timing fix, but found
clear45-degree labels rejected by their own wire because collision used the
rotated label's axis-aligned bounds. Wire collision now uses label-local axes;
the visual oracle independently clips segments against actual SVG quadrilaterals.
Four diagonal directions have clear/crossing pure regressions. The new headed
negative also exposed that zero-height horizontal paths were excluded from
painted-wire checks; stroked nonzero-length paths now count. Its first restore
attempt selected a different path after Playwright considered the horizontal
negative hidden; restoration now keeps a stable original path locator. Retain
those failing controls rather than treating them as product passes.

The headed trace review also found12px controls and overlap with the bottom
Connections control. Trace/browser text is now14px, headings16px, trace height
fits content and its bottom spacing clears the control. Overview checks enforce
the14px floor and trace/control separation, including a deliberate8px negative.
The complete72-item phone hierarchy/trace journey passed in43.8s with one headed
browser, one worker, zero retries and strict cleanup;42 scoped geometry/overview/
relationship tests and web types passed. Exact5b CI40716064148 failed its actual
2000-item visible-content timeout with zero labels; its artifacts are retained.
The current rotated-label correction still needs fresh scale CI and review.

The corrected diagonal headed journey passed in13.4s: all four zoom stages have
visible readable labels, the injected horizontal crossing is rejected, restoring
the original path clears it, exact two-record browsing and the1200ms visibility
negative pass, and the API snapshot remains unchanged. The existing horizontal
desktop/phone cases also passed in the preceding35s batch; the batch's diagonal
negative failure is retained separately.

The owner's next visual steering requires stronger wires, icon-based workspace
view navigation with hover/focus labels, and firmer text across the app. The
previous workspace CSS explicitly hid navigation SVGs below1600px and forced
12px captions. Replace that override with44px icon controls,24px glyphs and14px
hover/focus labels, including Escape dismissal and accessible button names.
Body text uses500 weight, control medium600; standard small text and explicit
10/11px utility usages now use a14px floor. Readable wire weight is one3px
screen-space value across zoom/hover restoration, with90% stroke opacity and
non-scaling12px hit targets. Overview buses use3.5px. This changes presentation,
not canonical relationship strength or data.

Latest serial headed checks: three item-symbol/navigation cases passed36.2s;
desktop1440 and phone360 all-eight-view saved-work journeys passed24.6s; the
phone390 hierarchy/trace journey passed26.0s. Types passed. Small probes reuse
owned dependencies. The priora378 CI40719477629 completed the actual2000/5000
stage successfully but its broader suite was still running when this visual
checkpoint was prepared. Retain that stage metadata without claiming full-run
or artifact acceptance; new exact-source CI remains required. Independenta378
review also records ordinary minimap occlusion of a full card's far-right strip;
current geometry checks establish label clearance, not universal card/overlay
clearance during arbitrary panning.

Independent review5685989836 reproduced a mixed-input tooltip failure: focus
Graph, hover Dashboard, then leave Dashboard; Graph remained focused but lost
its visible name. Track hovered and focused view IDs separately, with explicit
Escape dismissal. The focused label returns when the other hover ends, and
Escape hides it without moving focus. The desktop headed regression passed
14.4s on 2026-10-28 (one worker, zero retries; retained output
`item-symbols-headed15`); final exact-source CI and independent review remain
required. Isolated hover and keyboard checks alone missed this interaction.
