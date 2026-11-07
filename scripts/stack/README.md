# Stack scripts

Called by `./start` (and directly) from the repo root.

| Script | Used by |
| --- | --- |
| `setup.sh` | `./start setup`, `dev`, `clean` — install dependencies, build `@graphdone/core` |
| `run.sh` | `./start dev`, `quick`, `clean`, `deploy` — start the servers |
| `build.sh` | `./start build` |
| `test.sh` | `./start test` |
| `cleanup.sh` | `./start clean` — stop stray processes |
| `deploy.sh` | Run directly; staging/production deploy helper |
