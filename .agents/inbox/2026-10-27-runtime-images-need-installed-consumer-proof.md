# Runtime pruning needs actual consumer and persistence evidence

Date: 2026-10-27. Issue #185. Searches of the symptom/security indices found
consumer-verified dependency and startup lessons, but no runtime-pruning contract.

## Evidence

`docker run --rm --entrypoint node -i graphdone-audit-patched-api:20261023
--input-type=module < tests/runtime/image-inventory.mjs` failed on installed
Vite/Vitest/compiler/lint dependencies. A selected production install removed
them, but the first real compiled API launch failed `ERR_MODULE_NOT_FOUND` for
`graphql-tag`. The dependency had been supplied by the excluded web workspace.
Declaring the existing locked version in server restored the real consumer.

Review also found a remaining npm-based startup shell call, proposed UID drift,
an SDK root entry that is intentionally absent, and auth volumes targeting a
directory different from the process's store. The final source removes the
redundant shell call, preserves runtime identities, validates SDK subpaths and
points production volumes at the actual store. Three final image contracts pass
real API/MCP/database readback and account recovery after container replacement.
Host server 211/211, harness 192/192, types and lint pass; final CI remains required.

The full Trivy 0.76.1/dated-DB inventories show 0 npm findings in all images, 0 OS
findings in the Alpine variants, and 228 residual Bookworm OS entries after the
tzdata update. A raw critical MiniZip entry has a specific Debian applicability
explanation; this does not justify dismissing the rest. Full provenance,
commands, negative controls and limits are in the
[runtime packaging record](../../docs/quality/RUNTIME_IMAGE_PACKAGING_2026-10-27.md).

## Cause and corrective rule

A successful monorepo build can hide undeclared imports supplied by another
workspace. Copying a pruned root node_modules alone can lose nested dependencies,
native binaries, process identity or data ownership. Install selected production
consumers from the lock, preserve workspace-local trees, compile native code
against the runtime libc, and execute the actual compiled consumers. Test the
real data mount across container replacement; in-memory SQLite is insufficient.
Use the image's default production configuration for missing-secret tests.

## Limits

Present packages are not necessarily reachable surfaces. Scanner output and
package counts do not establish exploitability or full-image security clearance.
Retain raw findings and use primary distro evidence for scoped applicability.
No deployment, volume migration/deletion, identity change or protection change
is authorized by an image inventory or this lesson.
