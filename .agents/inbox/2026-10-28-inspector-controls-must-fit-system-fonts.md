# Navigation must fit without shrinking its labels

Date: 2026-10-28. Existing readable-preview, shared-symbol and browser-evidence
lessons were searched before this follow-up to issue225.

## Evidence and cause

The actual3ec563c showcase laptop screenshot clipped the inspector's Diagram
tab. That showcase had four items and no connections; it establishes this
control-fit defect, not routing or scale acceptance. The legacy row was not new
to this PR, so the observation alone does not attribute its origin to226.

A DOM-only probe on the owned headed graph copy set the inspector's font to
DejaVu Sans. Output: clientWidth286, scrollWidth303; Diagram right1363.53 exceeded
the panel's right1348. `fc-match 'DejaVu Sans'` returned
`DejaVuSans.ttf: "DejaVu Sans" "Book"`. The real long-content desktop regression
on3ec563c then failed in19.72s with29px horizontal overflow (one pixel allowed).
Command: `playwright test tests/e2e/graph/inspector-readability.spec.ts --grep1440
--project=GraphDone-Core/dev-neo4j/chromium --headed --workers=1 --retries=0
--trace=retain-on-failure --reporter=json`. The inspector's vertical scrollbar
also consumes space; a local-font screenshot alone missed the intrinsic label
width constraint.

Three unbroken labels, icons, gaps and padding had a combined minimum width
larger than the panel. Flex shrinking does not override that content minimum.
Hiding overflow or reducing working text would conceal the symptom.

## Corrective rule

Use24px mode icons with at least44px targets, accessible names and pressed state.
Keep readable hover/focus captions in a viewport-bounded portal so the scrolling
panel cannot clip them. Escape dismisses the hint before the parent inspector;
scrolling, wheel gestures, resize, outside pointer-down, mode changes and a new
inspected item discard stale hints. An unavailable Diagram remains keyboard
discoverable through aria-disabled with an explanatory caption; activation must
not change the mode. Never confuse aria-disabled with the native disabled
property when writing an oracle.

## Regression and limits

The actual inspector journey applies a wider system font and checks zero panel
overflow, all three44px targets, hover and keyboard-focus captions, viewport
bounds,14px/500 text floors and Escape dismissal in docked, compact and short
windows. It records control/tooltip geometry in JSON and actual tooltip PNGs.
Component cases check unavailable-mode behavior, one hint at a time, context
reset and dismissal. The first component assertion used jest-dom's native-only
toBeDisabled matcher against aria-disabled; the corrected oracle verifies the
ARIA state plus guarded activation and leaves the real wider-font negative intact.
TypeScript also rejected Playwright's `exact` option in Testing Library role
queries (TS2769); use its supported exact string-name matching instead.

This does not prove every font, localization or every unrelated app control.
Required full CI and exact-source artifact review remain necessary; screenshot
review caught the defect that earlier default-font local assertions missed.

Final local evidence on 2026-10-28: the two real desktop/phone browser journeys
passed in 47.09s with no retries. Eight PNGs and two JSON files were inspected;
all six docked/short/compact control groups had zero horizontal overflow,
44px targets and 14px/600 captions inside the viewport. The fixtures contained
301 items/564 edges and 72 items/132 edges. Both recorded zero writes and no
page errors. Nine focused component/projection/rendering tests passed in 3.12s;
web TypeScript passed and scoped ESLint reported zero errors (two existing any
warnings). These focused checks are not a substitute for full hosted CI.
