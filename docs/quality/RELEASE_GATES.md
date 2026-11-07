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

[Release](../../.github/workflows/release.yml) then runs
[`scripts/verify-release.mjs`](../../scripts/verify-release.mjs), which fails
closed unless the tag is `vMAJOR.MINOR.PATCH[-suffix]`, points at a commit on
main, every workspace manifest carries that version, and the newest run of each
required check (`CI Success`, both Node unit matrices, `Installer & Deploy
Config`) completed successfully on that exact commit. Only then do write-scoped
jobs build `ghcr.io/graphdone/graphdone-{web,api,neo4j}` from the verified SHA
for amd64 and arm64 with SBOM and provenance, and create the GitHub release with
the image digests. `latest` moves only when the tag is the highest version, and
releases run one at a time.

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
