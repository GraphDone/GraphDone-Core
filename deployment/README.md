# Deployment

Container images and compose stacks. Commands run from the repo root.

| Path | What it is |
| --- | --- |
| `Dockerfile`, `neo4j.Dockerfile` | Application and Neo4j images |
| `docker-compose.yml` | Production stack (`npm run docker:prod`) |
| `docker-compose.dev.yml` | Development stack (`npm run docker:dev`) |
| `docker-compose.http.yml`, `docker-compose.registry.yml` | Plain-HTTP and prebuilt-registry variants |
| [`self-host/`](self-host/) | Source-based self-host stack (Caddy + nginx), driven by `scripts/self-host.sh` |

Multipass VMs are scripts, not images: see [`scripts/vm/`](../scripts/vm/README.md).
