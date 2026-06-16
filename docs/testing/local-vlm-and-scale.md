# Local VLM visual review & large-scale performance sweeps

Two heavier, report-only suites that exercise GraphDone from realistic user
perspectives and at scale. Both are **opt-in and run locally** (or on a
self-hosted runner) because the vision models live on your own GPU boxes —
their hostnames must never enter the repo.

## TL;DR

```bash
cp .env.test.example .env.test.local     # gitignored — put your real values here
# edit .env.test.local: VLM_ENDPOINTS, VLM_MODEL, (optional) sweep sizes

./start dev                               # or have the stack running on :3127

TEST_URL=http://localhost:3127 npm run test:perf:scale   # → test-artifacts/scale-sweep/index.html
TEST_URL=http://localhost:3127 npm run test:vlm          # → test-artifacts/vlm/index.html
```

If `VLM_ENDPOINTS` is unset, `test:vlm` **skips cleanly** — so CI and other
developers are never blocked by hardware they don't have.

## Keeping hostnames out of the repo

- **Never** commit hostnames, IPs, or keys. The GPU boxes (e.g. an RTX 4090
  workstation and Grace-Blackwell nodes) are referenced only by env vars.
- `.env.test.local` is gitignored (see `.gitignore`). It is the *only* place
  your real endpoints live.
- `.env.test.example` is committed and documents the variable **names** with
  placeholder hosts (`http://<gpu-host>:<port>`). Copy it to `.env.test.local`
  and fill in the rest.
- The harness auto-loads `.env.test.local` via `tests/helpers/testEnv.ts`.

```bash
# .env.test.local  (NOT committed)
VLM_ENDPOINTS=http://<host-a>:<port>,http://<host-b>:<port>,http://<host-c>:<port>
VLM_MODEL=<your-vision-model-tag>
VLM_PROTOCOL=auto        # auto | openai | ollama
VLM_MAX_CONCURRENCY=3
```

Multiple endpoints are **round-robined**, so visual evaluation spreads across
every GPU you list.

## VLM protocol support

`tests/helpers/vlm.ts` is protocol-agnostic and auto-detects per endpoint:

| Protocol | Detected via | Request |
|----------|--------------|---------|
| OpenAI-compatible | `GET /v1/models` | `POST /v1/chat/completions` with an `image_url` data URI (vLLM, LM Studio, llama.cpp server, Ollama's `/v1` shim) |
| Ollama native | `GET /api/tags` | `POST /api/chat` with a base64 `images[]` array |

Force one with `VLM_PROTOCOL=openai` or `ollama`. Each model call asks for a
strict JSON verdict `{pass, score, issues[], summary}`, parsed leniently.

### Personas

Each captured screenshot is judged from several perspectives (see `PERSONAS`
in `tests/helpers/vlm.ts`):

- **Visual defects** — overlapping/cut-off nodes, unreadable labels, broken
  layout, missing edges, error chrome.
- **New-user clarity** — is the screen legible and inviting to a newcomer?
- **Accessibility** — contrast, text size, color-only signals, target size.
- **Living-graph aliveness** — do glow/breathe/flow status cues read clearly?

Report-only: a **FLAG** is the model's subjective concern, surfaced for a human
to look at — it never fails the build. The suite *does* assert the model
answered, so a broken client is still caught.

## Large-scale perf sweep

`tests/perf/scale-sweep.spec.ts` seeds real graphs (via the GraphQL API, the
same path a human/AI uses) of increasing size, loads each at one or more
quality tiers, and records the in-app `window.__graphPerf` readings plus load
time, settle time and query latency.

```bash
# .env.test.local
SCALE_SWEEP_SIZES=50,200,500,1000,2000     # blank => small in CI, large locally
SCALE_SWEEP_QUALITIES=HIGH,ULTRA
```

Metrics per (size, quality):

- **Reliable (measured directly from the browser, captured at every size):**
  rendered node/edge counts, initial load ms, graph-scoped query p95, and
  **interaction FPS** — real rendered frames/sec while a node is dragged
  (counted via `requestAnimationFrame`, so it needs no app instrumentation and
  reflects how janky the graph feels under interaction at scale).
- **Best-effort bonus (from the app's `window.__graphPerf`, which only
  publishes ~every 2s while the sim ticks):** settle ms (to `alpha ≤ 0.02`),
  avg/p95 sim tick ms, layout drift (`rmsFromSavedPx`). These can be blank for
  graphs that settle instantly — `interactionFps` is the headline signal.

A FRESH graph is seeded per (size, quality) so each measurement starts from an
unsettled layout (otherwise the second quality loads the first run's settled,
pinned positions and the sim never ticks). Output:
`test-artifacts/scale-sweep/index.html` — a table plus inline SVG charts of how
each metric scales, with the `@perf` budgets drawn for reference.

Report-only; the only hard assertion is that a seeded graph actually renders.
Each seeded graph is deleted afterward (edges first, then nodes, then graph).

## CI

GitHub-hosted runners can't reach your local GPUs, so neither suite gates
merges there. To gate on them, register a **self-hosted runner** on a machine
that can reach the endpoints, give it the `.env.test.local`, and add a workflow
job (manual-dispatch or nightly) that runs `npm run test:perf:scale` /
`npm run test:vlm`. The scale sweep alone (no VLM) is safe to run on any runner
with the dev stack and a small `SCALE_SWEEP_SIZES`.
