# Visual screenshot suite

The standalone Chromium suite captures 10 screens at each of 20 viewport sizes,
from 360-pixel phones through 5120-pixel ultrawide desktops. It uses the viewport
and pixel density from the spec. Compare the resulting PNGs between runs for
visual regressions. There is no automatic baseline comparison.

Start an owned disposable Core stack with an admin test account. The suite
signs in once, creates a connected fixture graph, and deletes that graph after
the captures finish. Use `TEST_ADMIN_USERNAME` and `TEST_ADMIN_PASSWORD` to override the
default test credentials.

```bash
npm run test:e2e:visual -- --list
TEST_URL=http://localhost:3127 npm run test:e2e:visual
TEST_URL=http://localhost:3127 npm run test:e2e:visual -- --grep 'iPhone-SE.*capture graph-view'
```

`TEST_URL` defaults to `http://localhost:3127`. The suite is also called by
`scripts/vm/test-vm-e2e.sh`. Set `RUN_VISUAL_REGRESSION=false` to skip it in
the VM. The default E2E config and smoke gate exclude the visual suite.

Each capture checks the route and expected screen before saving the image.
Signed-out captures cover `/` and `/login`. Signed-in captures cover the Cards
and Graph workspace views, Settings, Agents, Ontology, Administration, the
Administration Users tab, and Backend Status.

```text
test-artifacts/visual-regression/<run>/
├── iPhone-SE/
│   ├── landing-page.png
│   ├── graph-view.png
│   └── ...

test-artifacts/reports/visual-regression/<run>/
├── report/index.html
└── playwright-output/
```

The Playwright report links to each successful capture and retains failure
diagnostics. The `playwright-output/` directory also contains the test login
state. Share only the intended screenshots or report.
