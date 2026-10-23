# Locked touch acceptance must verify the current editor and durable owned work

Date: 2026-10-23. Searched `CLAUDE.md`, the responsive/mobile acceptance lessons,
`docs/quality/NEW_USER_GATE.md`, `touch-graph.spec.ts`, the graph's touch handlers,
`QuickEditSurface`, and `NodeQuickEdit`. Tracks public issue #156.

The strict mobile run on clean source
`f8a11e16a593738d485547eb1dfe117438cc3ed6` completed 27 actual cases: 26 passed
and one failed, with zero skipped cases. Its unified report also added an
execution-evidence failure for the nonzero Playwright exit; that synthetic row
is not a second failed browser case. Starting and ending source fingerprints
matched (`5846dde3dcce32baf391d875b32c6e437723ade56c50292848ad5b1b84ebcc0e`).

```text
mobile/touch-graph.spec.ts:
single tap on a node opens the inspector (even while locked)
getByTestId('node-inspector'): element(s) not found after 8000 ms
```

The retained screenshot shows the quick editor for a default tutorial item,
including its title, description, type, and status controls. Source confirms
that both a direct `touchend` tap and a touch compatibility click intentionally
call `setQuickEditNode`; `QuickEditSurface` is the accessible `Edit work item`
dialog. Ordinary mouse selection still uses the inspector path. The failed
test asserted a historical component identity and selected arbitrary default
data, rather than verifying the current touch editing outcome.

The focused correction creates one owned graph/task with known saved
coordinates, selects it explicitly, checks its rendered ID, and asserts Locked
before and after actual touch taps. It requires the visible current editor and
the correct title, edits the title, validates the exact single-item HTTP and
GraphQL acknowledgement, and independently reads the persisted task. Reloading
and tapping again must show the saved title while saved coordinates remain
unchanged. Cleanup confirms edges, task, then graph in order, retaining remaining
ownership links if a preceding stage fails.

The existing 90-second test limit, 30-second initial node-visibility wait,
four-second settling wait, and eight-second editor deadline are unchanged.
Independent source review found no threshold weakening. Actual Playwright
collection remains one touch case. The failed report and screenshot are retained
in the owned worktree as `test-artifacts/audit-20261023/mobile-before-report.json`
and `mobile-touch-before.png`.

Two focused test-development iterations reached the successful save and API
readback but failed while checking the reloaded SVG label. Raw group textContent
concatenates separate line elements without spaces. The first attempted fix
incorrectly assumed tspans. Inspection of both title creation and update paths
confirmed separate `text.node-title-text` elements; the final assertion joins
those actual rendered line texts with spaces and requires exact full-title
equality, retaining the same five-second assertion deadline. Both failed logs,
JSON reports, and traces remain as `touch-final*` and `touch-verified*`.

The final functional patch ran against unchanged combined application
`e120df4b849969854ffe529a64df3d42498ae4cf` on 2026-10-23, Node 22.23.4,
bundled Chromium, and the owned localhost API/Neo4j stack:

```text
TEST_URL=http://127.0.0.1:13127 QC_API_URL=http://127.0.0.1:14127/graphql \
xvfb-run --auto-servernum npx playwright test tests/e2e/mobile/touch-graph.spec.ts \
  --project=GraphDone-Core/dev-neo4j/chromium --headed --workers=1 --retries=0 --trace=on
1 passed (14.7s), 0 skipped, 0 retries
```

The saved readback contains exactly the created task, title `Saved by a locked
touch`, status `PLANNED`, and unchanged position `(400, 300, 0)`. Touch capability
was enabled, Locked assertions passed, the reloaded editor displayed the saved
title, and all edge/task/graph cleanup counts passed. The JSON readback is
attached by artifact path for retention in unified reports. Final log, JSON,
readback, and trace are retained as `touch-complete*`. No test assertion changed
after this passing run; only this evidence note was completed.

Corrective rule: identify the intended input-specific user outcome in source,
then assert owned content and durable effects. Replacing an obsolete selector
alone is insufficient. Use touch input rather than a synthetic mouse click, and
do not unlock the graph merely to make a tap test pass.
Inspect the renderer before choosing SVG text selectors; do not guess its line
element structure from a concatenated string alone.

Limits: this browser-emulated touch check does not establish native mobile
keyboard, assistive-technology, or physical-device behavior. It does not test
dragging, panning, multi-touch gestures, or access-control boundaries. The focused
pass does not replace the final complete mobile gate. No application
implementation change is part of this test correction.
