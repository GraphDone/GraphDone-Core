# Repeatable quality sequences

Run from GraphDone-Core. These commands use disposable local fixtures. Never substitute a production URL for a local stress or security target.

## Prerequisites

Core frontend: `http://localhost:3127`; Core API: `http://localhost:4127` with local Neo4j and seeded test admin. For Cloud contracts, run the sibling Cloud Worker with its local migrated D1 database on port 8797; the Cloud-configured frontend runs on 3129.

On this workstation:

```bash
export DISPLAY=:1
export PLAYWRIGHT_BROWSERS_PATH=/tmp/graphdone-playwright
export TEST_URL=http://localhost:3127
```

Elsewhere, install Playwright Chromium and use your normal headed display. Run one headed browser suite at a time so background throttling does not invalidate motion/performance measurements. Finish source edits before starting: development hot reload can reset a dialog mid-test.

## Standard order

1. `npm run build --workspace=@graphdone/web` — TypeScript and production build must pass; record bundle warnings.
2. `npm run test --workspace=@graphdone/web` — web unit suite must pass.
3. `npm run qc:new-user` — responsive modes, guest/admin dialogs, recorded AI work, task lifecycles, graph editing, motion, resize and button fit. No skipped or timed-out case counts as a pass.
4. `npm run qc:graph-first` — create a graph and task entirely through the UI, verify a real saved drag, grow and name connected work, post progress, and reload. API calls verify and clean up; they do not create the fixture. Then `npm run qc:controls` — every quick-editor type/status and keyboard priority, with backend readback, at phone and desktop sizes.
5. `npm run qc:layout` — 12 stacked, 50 and 200 connected cards; zero card overlaps on load and reload. This measures tested sizes, not an upper limit or label/edge-routing clearance.
6. `npm run qc:verification` — hosted-guest widget UI with Cloudflare's official public testing key, token transport and phone portrait/landscape fit. This uses the Core test backend; the Cloud verifier is tested separately below. It does not validate production Turnstile configuration.
7. `npm run qc:agents` — human creates project-scoped access, agent reads and updates work, both leave notes, read-only and revocation boundaries are enforced. Then `npm run qc:modals` for header clearance and Escape dismissal. `npm run qc:visual` — captured desktop, portrait and landscape sign-in/workspace states. Inspect the screenshots; automated geometry alone cannot judge visual quality.
8. In GraphDone-Cloud run `node scripts/test-security-limits.mjs`, `node scripts/test-multiple-graphs.mjs`, `node scripts/test-date-tags.mjs`, and `node scripts/test-turnstile.mjs`, and `node scripts/test-agent-connections.mjs`. Each must exit zero. Local quota concurrency does not prove a distributed production limit; mocked Siteverify cases do not prove production keys.
9. Run `QC_BACKEND=cloud QC_API_URL=http://localhost:8797/api/graphql TEST_URL=http://localhost:3129 npm run qc:modes`, then `qc:personas` with the same variables. These test hosted-schema behavior against local D1.
10. `npm audit --omit=dev --json` and web lint. Preserve findings and triage them; do not turn an audit failure into a passing security claim.

Before release, follow GraphDone-Cloud `docs/PAGES_RELEASE.md` to build and validate the exact Pages artifact, then finish `RELEASE_QC.md`. Publishing is a separate step.

## Hands-on sequence still required

Use `GRAPH-FIRST-01` in `SCENARIOS.md`: create a private graph using the selector, create a task through the form, pointer-drag it, grow/name connected work, edit details, change/reverse/remove a connection, undo, and reload. Record screenshots and saved results in `SCENARIO_RESULT_TEMPLATE.md`. The prior hands-on pass covered create/drag/grow/details; its create/drag/grow/progress/reload sequence is now codified in `qc:graph-first`; complete connection-menu and undo evidence is still pending. Do not replace these missing assertions with a claim that every UI control is covered.

## Evidence and limits

Screenshots live under `test-artifacts/quality/`. Playwright traces, failures and attachments live under `test-artifacts/playwright-output/`; test logs should be retained with the source revision. `RELEASE_QC.md` records the actual runs from this session, including initial failures and retries. `TEST_STRATEGY.md` lists uncovered security, collaboration, accessibility and stress scenarios. The older report-only scale and chaos suites are not substitutes for these correctness gates.
