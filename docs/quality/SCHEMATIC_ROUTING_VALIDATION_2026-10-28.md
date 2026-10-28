# Schematic routing validation — 2026-10-28

Candidate continuation of #216, #218 and #219, based on frozen nested source
`a311154bf154af977a238d4b5de55773efa4e2dc`. Final accepted source/review/CI identities
belong in the PR. This is not a full application acceptance claim.

## Small local checks

- Four new relationship component cases failed against the unchanged a311
  overview at the missing all/internal/endpoint/neighborhood controls. Retained:
  `/tmp/graphdone-resolution-20261027/relationship-component-negative.log`.
- The candidate's focused relationship model/components and existing nested
  component regressions passed 16 cases with one worker and no file parallelism
  in 4.36 seconds. This includes source identity, 100+ degree hub, directions,
  two-hop traversal, missing endpoints, inspection return, removed-row focus and
  no position scan/lane shuffle for camera pan. Log: `schematic-scoped-components.log`.
  The final bottom-mounted Connections control was subsequently repositioned to
  avoid adding another row to the phone toolbar; final CI must cover that source.
- Six pure geometry cases passed in about 0.3 seconds on Node 22.18.0. The explicit
  spaghetti fixture is rejected; accepted chain/fan-out/dense/phone fixtures
  conserve all original IDs, retain a useful visible minimum and have zero card
  intersections, unrelated contacts/overlaps or diagonal segments. Input reorder
  preserves lanes. Log: `schematic-routing-bounded.log`.
- The actual unified CLI child/manifest regression suite passed 31 cases in
  4.14 seconds, including strict schematic sequence/config/CI enrollment. Log:
  `schematic-cli-enrollment.log`.
- Web typecheck passed in the owned component probe after supplying the built
  core dependency. The first attempt correctly failed because that clean-installed
  probe lacked `@graphdone/core` build output; its failure is retained in
  `schematic-scoped-typecheck.log`. Core tracked source was proven unchanged
  between the probe base 43ada01 and a311, and unmodified in the probe; the existing
  validated a311 core output was copied. Corrected log:
  `schematic-scoped-typecheck-with-core.log`. This is scoped type evidence, not a
  substitute for CI's clean build of the complete candidate.

All named logs are in the retained directory above. No local browser or database
was launched for these checks after the owner's workstation constraint.

## Visual inspection and limits

The [static contact sheet](schematic-routing-study/index.html), four SVGs and
[metrics](schematic-routing-study/metrics.json) use the same pure router now wired
into the overview. SVGs were rasterized with installed `rsvg-convert`; fan-out,
dense and phone images were inspected. That inspection caught a phone title
running outside its card; word wrapping was adjusted before retaining the final
artifacts. A real SVG text-bound/overlap check now lives in the CI-only schematic
browser sequence. Its four required cases and screenshots are pending actual CI;
static raster inspection is not a passing browser test.

The dense fixture contains 112 relationships: 33 are represented by 13 routed
branches and 79 are explicitly collapsed. This is honest accounting and a clean
initial overview, not completed dense-graph exploration. Named focused-bus tracing
is still required so each selected area's full relationships can be followed.
Item-level D3 wiring still uses its earlier geometry. Neither 1k/10k performance,
hosted parity nor release/deployment is established by these small fixtures.

## Broad gates

The prior a311 CI and Comprehensive workflows passed, with complete exact-source
reports recorded in #216. Their results do not accept the new router/components.
The new candidate requires independent exact-source review, clean CI unit/build/
type/lint/runner checks, the new four-case static visual sequence and existing
strict graph/layout/mobile/new-user/database/runtime gates. Heavy local matrices
remain stopped. User-directed interruptions and earlier D-Bus failures are kept
in the linked [workstation lesson](../../.agents/inbox/2026-10-28-browser-acceptance-needs-an-owned-session-bus.md).

## Independent review corrections and retained CI failure

Review of a04fa2b found stale member-ID snapshots in open group/bundle lists and
a routing allowance that reset for each failed search. Four new component cases
and an actual failed-search allowance case failed before correction. Stable
hierarchy selectors now resolve live membership; removed groups are explicit.
One invocation-wide attempt/state budget covers successful and failed searches.
The Connections count includes its internal, pending and deferred partitions.

Corrected scoped results: 22 component/model cases passed in 5.53s; 8 geometry/budget
cases passed in 0.24s; web typecheck passed. Earlier negatives are retained. See the
[canonical correction lesson](../../.agents/inbox/2026-10-28-bus-views-need-live-membership-and-total-budgets.md).
The dense fixture now routes 33 original edges through 13 branches, explicitly
collapses 79, and records 32 attempts/3,495 examined states. This remains a partial
overview pending focused tracing; the fixture was not reduced.

Actual a04 CI 40629282719 failed the new visual gate: 3 of 4 cases passed, while the
phone Delivery label entered its required padding by 0.265625px. Its trace and
screenshot are retained. The generator now wraps more narrowly without changing
font, card size, assertion tolerance, timeout or retries. The revised four-case
browser acceptance and broader candidate CI remain pending. Prior green jobs
and Comprehensive 40629282743 do not accept the revised source.

## Actual overview integration gate

The existing desktop/phone nested journeys now measure the actual rendered paths
and card/control rectangles, require visible routes and exact represented/hidden
accounting, and retain an overview screenshot plus geometry JSON. They also browse
the real owned graph's full relationship IDs, filter parallel BLOCKS links, inspect
an endpoint and return with camera/filter/focus preserved, then verify incoming,
outgoing and two-hop neighborhoods against the original database snapshot. Existing
write-attempt guards and final database equality remain required. This reuses the
two small owned fixtures; no extra database or local browser is started.

The final two cases were discovered successfully in the owned lightweight probe
(`schematic-integration-current-discovery.log`); discovery is not execution. Their
new assertions require actual CI execution before acceptance.

Independent review of 41127f0 found ambiguous long-title selectors after adding
relationship buttons, and a geometry oracle that could accept transparent wires.
The member selectors now use their visible title text. Cards must have positive
visible bounds inside the viewport; wires must have visible ancestor styles and
actual stroke paint. An intentional opacity-zero wire in the real journey must
be rejected before restoration. These corrections remain pending CI execution.


## Focused group buses

The candidate adds incoming/outgoing group tracing with at most five neighbors
per page and fewer on constrained viewports. Every page retains the selected
group; all source relationships remain counted and available in the complete
list. Incoming routing shares the target trunk while preserving actual direction.
A newly mounted trace control is measured after commit as an obstacle.

Retained failing-before evidence:

- `schematic-incoming-negative.log`: 8 passed, 1 failed; the old router did not
  produce incoming shared-trunk junctions. The corrected 9 cases passed in 0.28s
  (`schematic-incoming-positive.log`).
- `schematic-trace-component-intended-negative.log`: 11 passed, 2 failed at the
  missing trace controls. The first command used the repository root instead of
  web's configured test environment and failed with `document is not defined`;
  `schematic-trace-component-negative.log` is retained as a setup failure, not
  feature-negative evidence.
- `schematic-trace-components-final.log`: 28 passed, no skips, 8.31s, one worker
  with no file parallelism. Includes paging every neighbor, live source removal,
  incoming/outgoing counts, tiny viewports, current-page clamping, original bundle
  identity, inspection return and existing nested/relationship regressions.
- `schematic-trace-typecheck.log`: scoped web typecheck passed.

Actual CI now also traces both directions in the existing two owned nested
fixtures, checks original source/target port placement and arrow presence, and
includes the trace controls among wire obstacles. Those browser assertions are
pending; no local browser/database or additional fixture was started. This is
not detailed item wiring, arbitrary selected-path tracing, a scale benchmark,
or accepted full application behavior.
