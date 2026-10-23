# A named volume protects SQLite only when it covers the process workspace

Date: 2026-10-23. Searched the deployment/runtime lessons and Compose files
before correcting issue #189. The production API image starts
`npm run start --workspace=@graphdone/server`, whose working directory is
`/app/packages/server`; SQLite and generated bootstrap credentials resolve
`data/` from that directory. Three legacy Compose variants instead mounted
`sqlite_auth_data` at `/app/data`. The self-host variant already used the
correct workspace path.

## Reproduction and correction

At source `ef495eff15ed7aac51e72dc7a1db1bb96d2b3695`, run:

```sh
GRAPHDONE_TEST_API_IMAGE=graphdone-audit-patched-api:20261023 \
  node scripts/test-sqlite-container-persistence.mjs
node --test tests/lib/production/sqlite-recreation.test.mjs
```

The standalone fixture uses the already built local API image
`sha256:a1972a2814c9cb94ea3265b94398b2e8a90620bb3ebbc24e1133e11cde52a263`.
No image is pulled or published. It derives the volume destination and admin
environment from the actual Compose configuration, creates a unique labelled
volume, and runs the compiled authentication store through the image's npm
workspace in two separately created containers. The first creates an owned
account; the second must retain its ID and validate its password. Both generated
and configured administrator cases also retain their ID. Generated credentials
must keep identical contents and mode 0600. The fixture never prints passwords
or credential-file contents.

Before the Compose correction, all seven checks failed: three mount checks,
two admin-forwarding checks, and two real recreation cases that lost the owned
account. After changing the mount to `/app/packages/server/data` without
changing the volume key, and forwarding optional production `ADMIN_EMAIL` /
`ADMIN_PASSWORD`, the same seven checks passed. The development Dockerfile
prepares that directory for UID/GID 1001. Artifact files are
`test-artifacts/release-runtime-20261023/sqlite-before.json` and
`sqlite-after.json` in the owned runtime worktree; both exits are retained
(1 before, 0 after). No test-owned volumes or containers remain afterward.

Four deterministic tests for the full-stack recreation hook pass: stable login
identity, rejection of a newly bootstrapped replacement identity, GraphQL errors
despite HTTP 200, and container-recreation failure. The hook requires actual
HTTP login before and after recreating only the owned API service. Its execution
against the final HTTPS stack is a separate release gate; these unit cases do
not claim that result.

## Corrective rule and limits

Test removal and recreation with the real workspace and volume, rather than
only restarting a process. Preserve the existing volume name. Before applying
this fix to an existing installation, back up the stopped old container's
runtime data directory, inspect existing volume contents, and restore the
chosen data without overwriting an unreviewed copy. Do not delete the old
container or volume before verifying restoration. The
[deployment guide](../../docs/deployment/README.md#preserve-existing-sqlite-data-before-recreating-legacy-api-containers)
records the migration requirement; migration is not automatic.

The standalone test validates compiled SQLite account/password persistence and
private bootstrap recovery, not the complete HTTP/GraphQL application, Neo4j,
power-loss behavior, backup recovery, concurrent writes or hosted D1 parity.
No shared database, existing volume, browser, registry or deployment was touched.
