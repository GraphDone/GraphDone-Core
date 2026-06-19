# Live Test Dashboard

A local, read-only web dashboard that is the **single guiding-light surface** for
test health and performance as you work. It watches every `graphdone.unified-report/1`
run produced across both repos, accumulates trend history, and **updates itself
live** (Server-Sent Events) the instant a new run lands — no zip, no manual refresh.

```bash
npm run dashboard        # serve at http://localhost:3199
npm run dashboard:open   #   …and open the browser
make dashboard           #   same, via make
```

Then, in another terminal, run tests as usual — each completed run appears live:

```bash
npm run test:unified                         # Core unified run  → appears live
node ../GraphDone-Cloud/scripts/full-live-test.mjs   # Cloudflare live run → appears live
npm run test:perf:scale                      # perf trends update on the Overview tab
```

## What it shows

- **Overview** — performance & health **trend charts over time** (suite pass-rate,
  failures, duration; graph idle/drag/interaction FPS, load time, tick cost, query
  p95, layout drift; physics settle time; VLM visual score) plus the most recent runs.
- **Runs** — every indexed run (newest first) with a status bar; click any run to
  drill into its sequences and **every citable check** (`§3.2.4`), with embedded
  **screenshots and video clips** and failure detail.
- **Media** — a gallery of all screenshots + videos for any media-bearing run.

## How it stays "continuous"

Core overwrites `test-artifacts/unified/` on every run, so the dashboard keeps its
own append-only history under `test-artifacts/dashboard/`:

- `runs.jsonl` / `metrics.jsonl` — tiny, unbounded trend history that survives the
  overwrite.
- `runs/<id>/` — media **snapshots** of clobber-prone runs (retention-capped, default
  12) so old screenshots/videos remain browsable. Cloud `live-full-report/<stamp>/`
  runs are already one-dir-per-run and are served in place.

This whole store lives under the already-gitignored `test-artifacts/`.

## Watched run roots

| Root | Mode | Source |
|------|------|--------|
| `test-artifacts/unified` | slot (overwritten) | `npm run test:unified` |
| `test-artifacts/unified-cloudcheck` | slot | cloud-check profile |
| `test-artifacts/unified-perfcheck` | slot | perf-budgets profile |
| `test-artifacts/unified-showcase` | slot | showcase profile |
| `../GraphDone-Cloud/live-full-report/<stamp>` | stamped (kept) | `full-live-test.mjs` |

Override paths with `--core <dir>` / `--cloud <dir>`; port with `--port` /
`DASHBOARD_PORT`; snapshot retention with `--keep <n>`.

## Architecture (zero runtime deps)

`node:http` + SSE + `fs.watch`/poll. The browser app imports the **same** pure
modules the Node unit tests do — served as native ES modules, no bundler.

- `format.mjs`, `charts.mjs` — pure + isomorphic (Node tests **and** `/static/`).
- `ingest.mjs` — discover + parse reports; classify slot vs stamped roots.
- `metrics.mjs` — normalize perf artifacts → one flat metric-point series.
- `history.mjs` — append-only JSONL store, media snapshot + retention.
- `page.mjs` — server-rendered HTML shell.
- `app.mjs` — browser entry (fetch APIs, render, live-update over SSE).
- `server.mjs` — orchestrator: index → serve → push.

Unit tests: `node --test tests/lib/dashboard/`.

## Security

Read-only and **bound to `127.0.0.1`** (no LAN exposure, no auth surface). No
command-execution endpoints. Media is served only from within a run's own report
directory (real-path checked, traversal/symlink-escape rejected) and only for an
allowlist of media extensions; `/static/` serves a fixed three-file allowlist.

## Autonomous loop (`scripts/dashboard-loop.sh`)

So the dashboard keeps living and improving across sessions/reboots, a cron-driven
loop runs `scripts/dashboard-loop.sh once` every ~30 min (system crontab, tagged
`# graphdone-dashboard-loop`). Each iteration: (1) ensures the dashboard server is
up, (2) self-checks it (`node --test tests/lib/dashboard/`), (3) runs ONE bounded
headless `claude -p` improvement iteration against `scripts/dashboard-loop.prompt.txt`.
A `flock` lock prevents overlap; the agent prompt has hard constraints (never
deploy, never touch secrets, never merge a failing gate). Run mechanical-only with
`NO_AGENT=1 bash scripts/dashboard-loop.sh once`. Disable the loop by removing the
`graphdone-dashboard-loop` lines from `crontab -e`. Logs: `test-artifacts/dashboard/loop.log`.
