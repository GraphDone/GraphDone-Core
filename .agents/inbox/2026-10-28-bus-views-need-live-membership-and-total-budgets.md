# Bus views need live group membership and one total routing budget

Observed 2026-10-28 UTC during independent review of schematic candidate
`a04fa2b9dfa580a4fe6c344cc00aa32bd6c8b83e`. Existing projection/ownership and
snapshot-merge lessons were searched through the symptom index first.

## Evidence

```text
2026-10-28, Node 22.18.0, single-worker scoped tests
Before: schematic-review-component-negative.log
  6 passed, 4 failed
  open internal view retained a member moved to another group
  new group member missing from the already-open internal view
  open bundle retained old endpoint membership
  Connections count omitted internal and unresolved relationships
After: schematic-review-component-final.log
  22 passed, 0 failed, no skips; 5.53s

Before: schematic-budget-negative.log
  6 passed, 1 failed
  with one allowed attempt, an impossible first route did not prevent
  a later successful search: expected zero routes, received one
After: schematic-budget-final.log
  8 passed, 0 failed, no skips; 0.24s
  failed searches spend the invocation allowance
  a one-state allowance stops remaining searches and retains every edge ID
```

Logs are retained under `/tmp/graphdone-resolution-20261027/`. The corrected web
typecheck passed in the existing owned scoped probe (`schematic-review-typecheck.log`).
No browser or database was started locally for these corrections.

## Cause and corrective rule

A named group is a live semantic selection, not a frozen list of member IDs.
Store a stable hierarchy reference and whether it selects direct members only;
resolve current hierarchy paths whenever source data changes. Derive current
headings from that hierarchy. Explain when a selected group disappears. Test
moves, newly added members, both endpoints of bundles and direct-parent subsets.

A cap on successful routes does not bound failed searches. Count attempts and
examined search states across the entire invocation, including failed paths.
Stop further work when either allowance is exhausted and retain every remaining
source edge in the explicit deferred partition. The current hard ceilings are
32 attempts (12 on narrow views), 6,000 examined states and a 4,000-point grid;
callers may lower them, not raise them. Those are deterministic operation limits,
not a frame-time or 1k/10k capacity guarantee. Publish actual work counts with the
small visual fixtures. The dense 112-edge fixture now routes 33 edges through 13
branches and explicitly defers 79; all IDs remain accounted for.

Counts must describe the whole partition they name. The Connections control now
includes internal, unresolved-endpoint and deferred external relationships in
its not-drawn total and explicitly names each denominator. Internal links do
not need synthetic canvas loops to make that accounting truthful.

## Rendered geometry is evidence too

Actual CI 40629282719 failed its new schematic visual sequence: 3 cases passed;
phone failed because Delivery's label ended at 259.265625 where the 8px-padding
boundary was 259. The additional execution failure makes the strict sequence
failed. Other runtime/quality success and Comprehensive 40629282743 do not erase
that failure. Retained artifact 12790822057 includes the screenshot and trace.

The source SVG generator now wraps at a narrower word boundary. The label's font,
card size, padding assertion, timeout and retry policy are unchanged. Regenerated
static pictures are review aids; only the next actual four-case CI run can prove
this correction against the browser font metrics. Never widen the visual
threshold to turn an observed overlap/padding failure green.

## Limits

These fixes do not complete focused-bus exploration or item-level wiring. Small
geometry/component results do not establish full browser/backend acceptance,
large-data loading or release readiness. Keep heavy local matrices stopped under
the owner's workstation constraint and require reviewed exact-source CI.
