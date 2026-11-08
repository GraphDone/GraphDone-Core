# UI fit: every screen on iPhone, iPad and desktop

The UI fit gate opens every screen and dialog in
[`tests/devices/screens.ts`](../../tests/devices/screens.ts) on each device in
[`tests/lib/ui-fit/devices.mjs`](../../tests/lib/ui-fit/devices.mjs). On each one it
measures every visible control (buttons, links, tabs, inputs, menus, graph card
controls). Apple devices run in WebKit, Safari's engine, with their real screen
size, pixel density and touch input.

The setup signs in once and creates a small connected `[E2E]` graph through
the real API, because a new user's starter graph has no connections. The
teardown deletes it, and the test-data sweep removes it if a run is
interrupted. Everything else only opens screens and dialogs, so the device
projects run four at a time.

| Device | Engine | Screen |
|---|---|---|
| Desktop Chrome | Chromium | 1440×900 |
| Desktop Safari | WebKit | 1440×900, Retina |
| iPad Pro 11", portrait and landscape | WebKit | 834×1194, touch |
| iPhone 15, portrait and landscape | WebKit | 393×659, touch |

## What it checks

Every rule applies to every control on every screen. The rules are listed in
[`tests/lib/ui-fit/rules.mjs`](../../tests/lib/ui-fit/rules.mjs) and unit tested in
`rules.test.mjs`.

| Rule | Fails when | How it is measured |
|---|---|---|
| `accessible-name` | A control has no name for screen readers | `aria-label`, labels or visible text |
| `clickable-is-control` | Something has a pointer cursor but is not a button or link, so a keyboard cannot reach it | Computed `cursor` on non-control elements |
| `center-hit` | A tap at a control's centre lands on something drawn over it | `elementFromPoint` |
| `text-contained` | A label sticks out of its box (deliberate ellipsis excepted) | Text range boxes against the control |
| `label-contrast` | A label is under 3:1 against the background the browser actually drew | Computed text colour against screenshot pixels, so native styling Safari applies on its own is caught |
| `icon-centered` | An icon-only button's artwork is more than 0.75 px off centre | Ink bounds in the screenshot |
| `vector-icons` | An icon is a font character (`+`, `⚙`, `×`) | Text content of icon-only controls |
| `in-viewport` | A control is cut off by the screen edge | Box against the viewport (scroll containers excepted) |
| `target-size` | A target is under 24×24 px and crowded (WCAG 2.2 2.5.8) | Hit area and spacing |
| `solid-panels` | A dialog, sheet or peek panel paints its background less than 85% opaque, so the page shows through its text (for example a CSS class the build does not know, like an opacity step of `/98`) | Computed background colour and gradient stops of each panel |
| `scroll-room` | An area that scrolls its content shows less than 120 px of it (pinned headers on a phone held sideways) | On-screen height of scrolling areas |
| `no-horizontal-scroll` | The page, or an area that scrolls up and down, also scrolls sideways (deliberate sideways strips such as tabs are fine) | Document and scroll-area widths |

Touch targets under 44 px are counted on touch devices and shown in the
gallery. They are reported, not gated.

Controls under an open dialog or menu, scrolled out of view, or panned under
the app's floating controls on the graph canvas are not judged. Pixel checks
run only on controls with nothing drawn over any part of them. The screenshot
is trusted only when the layout measured before and after it is identical.

There is no list of known problems. Any finding fails the gate until it is
fixed. [`tests/devices/ui-fit-exemptions.json`](../../tests/devices/ui-fit-exemptions.json)
holds only things that are right by design, each with a reason a reviewer can
check. Today there are two: the desktop mini-map and the wide invisible hit
area along each connection line are pointer shortcuts, and keyboard users have
a full route: card focus and Zoom to fit for panning, and "connections ·
Browse", whose rows each have Edit, for connections.

## Running it

```bash
npm run dev                      # or any running stack; TEST_URL points at it
npx playwright install chromium webkit
TEST_URL=http://localhost:3127 npm run test:devices
```

Results land in `test-artifacts/ui-fit/`:

- `index.html`: a gallery of every screen on every device, annotated (green: fits, red: problem).
- `<device>/<screen>.png`: the annotated screenshot.
- `<device>/<screen>.json`: every measurement and finding.

In CI, the `UI Fit (iPhone, iPad, desktop)` job runs on every pull request and
is required by `CI Success`. Its gallery is the `ui-fit` artifact, and its
findings appear in the job summary.

## Adding to it

- **A screen or dialog:** add an entry to `UI_FIT_SCREENS` that opens it. Every device and rule applies automatically.
- **A device:** add it to `UI_FIT_DEVICES` (any Playwright device descriptor).
- **A rule:** add it to `RULES` with the measurement in `collect.mjs`, a unit test in `rules.test.mjs`, and a row in the table above.
