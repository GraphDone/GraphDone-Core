# Main promotion and release gates

Source promotion, image publication and deployment are separate operations.
The production gate runs on main-target PRs, main pushes, nightly schedules and
manual CI dispatch. `CI Success` waits for it and rejects failed, cancelled,
missing or skipped results when selected. Dev-only events may legitimately skip
that job; their other required jobs must still pass.

## Current publication state

Docker Build Validation builds the web, API and Neo4j images for amd64 and arm64
without registry login, package-write permission, image pushes or stack manifests.
A container manifest cannot represent three different services as a deployable
stack. Image builds alone do not prove that those services work together.

Deploy and Release are explicitly disabled. Their manual actions fail before
checkout, credentials, version edits, tags, releases or deployment. The previous
placeholder echo statements were not deployment implementations. A main merge
is not deployment evidence. These workflows do not deploy graphdone.com or move a release tag.

Release implementation is tracked in [issue #190](https://github.com/GraphDone/GraphDone-Core/issues/190).
Before enabling publication in a separately reviewed change:

1. Select and record a complete immutable source commit SHA. Check out that SHA
   in every validation/build step; do not substitute the latest branch tip.
2. Require successful CI, Comprehensive Tests and the production-stack gate for
   that exact source. Pending, missing, failed, cancelled, flaky or skipped
   required evidence must prevent all registry/tag/release writes.
3. Keep PR execution read-only. Grant write permissions only to the authorized
   release operation after validation. Test the event/permission conditions
   without publishing before enabling writes.
4. Build using the lockfile and the intended Dockerfile, attach source and image
   digest provenance, and prevent an older concurrent run from moving a newer
   release tag. Version changes must be part of the validated tree.
5. Implement real environment-specific deployment and independently verify the
   deployed version and application/database health. A successful build, push,
   echo or worker-liveness endpoint is insufficient.

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
