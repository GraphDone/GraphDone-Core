# Scripts

Shell and Node scripts run from the repo root. Test suites live in `tests/`, not here.

| Path | What it is |
| --- | --- |
| [`stack/`](stack/README.md) | Local stack lifecycle behind `./start`: setup, run, build, test, deploy, cleanup |
| [`vm/`](vm/README.md) | Multipass VM launch, base image and VM end-to-end runs |
| `install.sh` | Public one-line installer (`curl … /main/scripts/install.sh \| sh`) |
| `setup_docker.sh`, `setup_git.sh`, `setup_nodejs.sh` | Prerequisite installers; `install.sh` and `./start` call them by these paths, so they stay here |
| `setup-git-hooks.sh`, `setup-mcp.sh`, `setup-oauth.sh` | One-off developer setup |
| `manage-certificates.sh` (`generate-dev-certs.sh` links to it), `generate-ssl-certs.sh`, `generate-multi-host-certs.sh`, `test-tls.sh` | Development TLS certificates |
| `self-host.sh` | Source-based self-host install (see `deployment/self-host/`) |
| `test-installation-simple.sh`, `generate-clean-report.sh`, `fresh-test.sh`, `verify-fresh.sh`, `github-actions-test.sh` | Installer and fresh-checkout checks |
| `render-schematic-routing.mjs`, `narrate-report.mjs` | Report generators behind `npm run report:schematic` / `dashboard:narrate` |
| `dashboard-loop.sh`, `dashboard-loop.prompt.txt`, `install-dashboard-service.sh`, `graphdone-triage.mjs`, `dogfood-cycle2.mjs` | Improvement loop and live dashboard service |
| `test-operations-local.mts`, `test-admin-bootstrap.mts`, `test-codex-connection.mjs`, `test-gateway-triage.mjs`, `testing/` | Local operator and connection probes |
| `init-db.sql`, `update-version-minimal.sh` | Database init and version bump helpers |
