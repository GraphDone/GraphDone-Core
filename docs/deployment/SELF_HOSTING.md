# Self-host GraphDone Core

Core includes the task app, human/agent notes, project-scoped agent connections, feedback inbox, administrator review and scoped operator access. No subscription is required for these capabilities. The hosted product sells managed operation and execution resources. See [product strategy](../product/CORE_HOSTED_STRATEGY.md).

From a checkout, with Docker Compose, Git and OpenSSL available:

```sh
./scripts/self-host.sh your-domain.example
```

Point your domain at the VPS and make ports 80/443 reachable. Caddy handles HTTPS. For a local installation use `./scripts/self-host.sh` and open http://localhost:8080. Existing configuration is reused on subsequent runs. `GRAPHDONE_SETUP_ONLY=1 ./scripts/self-host.sh` generates configuration without starting containers.

Sign in as **admin**. Retrieve `ADMIN_PASSWORD` from `deployment/self-host/.env`, a mode-600 file created on your machine. Back it up privately. The installer generates separate database, JWT, session and admin secrets. It does not use the demo credentials. Database/API ports are private, containers are not privileged, and the API runs as a non-root user. Source build contexts exclude environment files, runtime databases, certificates, keys, logs and node_modules.

The API uses the `auth_data` volume for both authentication and `operations.db`; Neo4j uses `graph_data`. Caddy has separate certificate/configuration volumes. `docker compose --env-file deployment/self-host/.env -f deployment/self-host/compose.yml down` stops services without deleting data. Do not add `-v` unless you intend to delete the installation's volumes. Back up the private environment file and all persistent volumes, and test restoration on a separate installation before depending on a backup.

New production installations outside this Compose setup can provide `ADMIN_EMAIL` and a strong `ADMIN_PASSWORD` (minimum 20 characters). Without a supplied password, the first-start bootstrap generates a random one and stores it in the persistent `data/bootstrap-admin.json` with mode 600. It does not create the development viewer. Existing accounts are preserved; upgrading does not silently change their passwords. Operators of older demo deployments must rotate the known demo credentials before exposing them publicly.

The old registry/development Compose files are legacy development paths; this is the recommended public-hosting path. This repository is not yet a published Hostinger one-click marketplace package. Build and startup validation results are recorded in the release QC ledger; runtime capacity depends on the machine and workload. The initial Neo4j heap/page-cache settings are explicit in `compose.yml` so operators can measure and adjust them.

SMTP/SSO and outbound model credentials are separate optional configuration. Never put provider keys into Vite variables. Core's feedback and operator APIs run on local SQLite and do not call graphdone.com or consume its D1 allowance. Optional AI runners use only the gateway you configure. The current Neo4j Core still has offline-sync/transfer parity work compared with the managed D1 build; this is tracked engineering debt, not a paid restriction.
