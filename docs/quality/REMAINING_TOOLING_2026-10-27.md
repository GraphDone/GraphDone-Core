# Turbo and Mermaid consumer migration — 2026-10-27

This completes the remaining npm-tooling slice of #185. It is stacked on the
reviewed runtime-packaging and camera corrections. It does not close Debian OS
triage #209, authorize publication or establish deployed-site clearance.

## Changes and compatibility

Turbo 1.13.4 becomes 2.11.10. The configuration uses `tasks` and declares the
existing npm 10.8.2 package manager. Explicit `envMode: loose` preserves the old
task environment behavior; this change does not silently adopt Turbo 2's strict
environment filtering. Build-affecting declared variables, including the offline
flag, remain in the cache hash. Task dependencies, outputs and persistent dev
tasks retain their previous meaning. No remote-cache login or publication is
performed by the contract tests.

The installed Turbo contract executes an owned two-workspace build: dependency
output must exist before its consumer, an unlisted environment variable must
arrive, changing the offline flag must invalidate both outputs, and an unchanged
run must reuse the cache. A real upstream task exits 23 with a unique marker;
the runner must fail and must not execute its dependent. Fixture removal is strict.

Mermaid 11.17.2 becomes 12.2.0. Its Node consumer resolves KaTeX 0.18.10; the
shipped browser IIFE embeds KaTeX 0.18.11. Both are above the advisory's 0.18.2
patch boundary. Mermaid remains a development/test dependency: the app exports
diagram text and does not load Mermaid into its application bundle. Browser
contracts load the actual installed IIFE from the web workspace, so a changed
npm hoisting location cannot silently select a different consumer.

Mermaid 12 changes default layout/appearance and raises its own browser floor.
The export acceptance explicitly selects dagre/default/classic to preserve its
existing rendering expectation. Node 22.18 and the installed Chrome meet the new
tool's requirements. GraphDone's application build target is unchanged; these
tests do not claim the Mermaid 12 renderer runs on older supported app browsers.

Only these dependency families and their required transitive package placements
change. No production dependency version changes, blanket overrides or runtime
image package additions are included.

## Evidence and limits

- Clean Node 22.18/npm 10.8.2 install succeeds. Fresh full and production npm
  audits both report zero findings on 2026-10-27; retained JSON records the dated
  advisory result, not a permanent absence of vulnerabilities.
- All-package build, types and lint pass. Coverage executes 715 passing tests
  plus the existing 26 explicitly skipped database cases. Those skips are not
  database acceptance; the separate real-Neo4j CI contract remains required.
  Harness 192/192 passes. Existing warnings remain.
- Installed Turbo, Mermaid/KaTeX and Vite contracts pass 3/3 on Node 22.18 and
  Node 24.22.1. Vite checks include real HMR state preservation, HTTP/WebSocket
  proxying, secret-file denial and offline-shell behavior.
- The old installed KaTeX 0.16.47 fails the inherited-trust regression: an
  options prototype can enable a JavaScript link. The patched consumer rejects
  it. The expression is inert test text; no link is clicked or script executed.
- An initial Turbo probe used mutually exclusive `--cache` and `--force` flags
  and failed before running a task. That failure is retained, not credited as
  task-failure propagation. The final probe uses local write-only cache mode and
  requires the actual failing child's unique output marker.
- The final composed offline production build and full portable-project browser
  journey pass (27.7 seconds, one worker, zero retries). The journey checks actual
  import/export, offline reload, malformed/quota failures, real exported Mermaid
  rendering, responsive controls and zero sync writes. Independent implementation
  review also repeated the two new contracts and old/new KaTeX negative. Final
  documentation review and exact-head CI are pending.

Local evidence is under the owned `/tmp/graphdone-resolution-20261027` directory
in `remaining-tooling-*` and `katex-inherited-trust-negative.log`. Final CI must
repeat applicable image, browser and Node-version gates; previous stack heads
do not establish acceptance of a changed composition.

Primary references:

- [Turbo migration and environment behavior](https://turborepo.dev/docs/crafting-your-repository/upgrading)
- [Turbo package-manager detection advisory](https://github.com/vercel/turborepo/security/advisories/GHSA-3qcw-2rhx-2726)
- [Turbo login callback advisory](https://github.com/vercel/turborepo/security/advisories/GHSA-hcf7-66rw-9f5r)
- [Mermaid 12 breaking changes](https://github.com/mermaid-js/mermaid/releases/tag/mermaid@12.0.0)
- [KaTeX inherited-trust advisory](https://github.com/KaTeX/KaTeX/security/advisories/GHSA-238p-pmpm-9mq7)
