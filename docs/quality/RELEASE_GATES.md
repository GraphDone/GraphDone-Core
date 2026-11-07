# Main promotion and release gates

Source promotion, image publication and deployment are separate operations.
The production gate runs on main-target PRs, main pushes, nightly schedules and
manual CI dispatch. `CI Success` waits for it and rejects failed, cancelled,
missing or skipped results when selected. Dev-only events may legitimately skip
that job; their other required jobs must still pass.

## Publishing a release

Docker Build Validation builds the web, API and Neo4j images for amd64 and arm64
on main-target PRs without registry writes.

A release is published only by pushing a version tag on a validated main commit:

1. Bump the version in a PR to dev (`scripts/update-version-minimal.sh <version>`
   plus the workspace manifests and lockfile), then promote dev to main.
2. Wait for main's CI and Comprehensive Tests on the merge commit to pass.
3. `git tag -a v<version> <main sha> -m "GraphDone v<version>" && git push origin v<version>`

Only admins can create `v*` tags (a repository tag ruleset).
[Release](../../.github/workflows/release.yml) then runs
[`scripts/verify-release.mjs`](../../scripts/verify-release.mjs), which fails
closed unless:

- the tag is `vMAJOR.MINOR.PATCH[-suffix]` and points at a commit on main's
  first-parent line — a commit main itself was at, not a dev commit merely
  merged into it (dev pushes skip the production gate);
- every workspace manifest carries that version;
- in the CI and Comprehensive runs that a push to main triggered for that exact
  commit, the newest attempt of each required job (`CI Success`, both Node unit
  matrices, `Installer & Deploy Config`) completed successfully. Pull-request
  runs test a merge ref, so they never count.

Only then do write-scoped jobs build `ghcr.io/graphdone/graphdone-{web,api,neo4j}`
from the verified SHA for amd64 and arm64 (SBOM and provenance, the same web
build arguments as the validated stack) and push the version tag. After every
image is published, the final job decides from the published releases whether
this version is the highest — a pre-release never outranks a stable release —
moves `:latest` on all three images together if so, and creates the GitHub
release with the image digests. Each tag runs in its own concurrency group and a
started release is never cancelled. The installer and
`deployment/docker-compose.registry.yml` pull `:latest`.

This repository does not deploy. graphdone.com is built from the `core/`
submodule of GraphDone-Cloud and deploys from that repository's main branch;
bump the submodule to the release tag there to ship it.

## Production acceptance

`xvfb-run --auto-servernum node scripts/test-production-stack.mjs --out test-artifacts/prod-stack`

The owned fixture runner builds the real Compose stack with private generated
credentials, waits for HTTP/application/database readiness, seeds bounded graph
fixtures and runs the strict user smoke sequence. It also checks authentication
persistence across API-container recreation with the same owned volume. Evidence
includes the source revision, stage outcomes and cleanup. Never point this runner
at existing user containers, databases or volumes.

Workflow regressions are part of `npm run test:unified:lib`. Run the production
command on a clean, exact candidate and retain its evidence before promotion;
review actual final main CI before closing the promotion issue. See
[the test strategy](TEST_STRATEGY.md) and
[issue #189](https://github.com/GraphDone/GraphDone-Core/issues/189).
