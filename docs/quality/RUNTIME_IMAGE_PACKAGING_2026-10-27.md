# Runtime dependency packaging — 2026-10-27

This implements the runtime-packaging slice of #185, based on reviewed toolchain
source `569ad9f`. It does not publish or deploy images. Main/release gates, hosted
acceptance and base-OS triage remain separate. A green inventory step proves a
scan completed; it does not mean every recorded finding has been cleared.

## Installed runtime contract

API, generic and self-host API builds install the lock's selected production
workspaces (core/server/MCP plus root production declarations), omitting dev and
optional packages and install scripts. Each build compiles SQLite against its
own image libc and copies that exact native binding into the production install.
Workspace-local dependency trees are retained. Compiled application output and
package manifests are copied; workspace source/test trees, compiled test files, Vite,
Vitest, TypeScript, tsx, ESLint, Turbo, esbuild, node-gyp and global npm/Yarn/
Corepack are excluded. The generic image still includes the built web assets.

`graphql-tag` was used directly by server schemas but declared only by the web
workspace. The reduced image exposed that missing declaration. The server now
declares the existing locked 2.12.6; no installed dependency version changed.
Root `passport-openidconnect` remains resolved through the explicit root install.
The API no longer shells out to `npm run create-admin`: the awaited SQLite
initialization already creates/checks the initial account before Neo4j startup.

Existing runtime identities remain API root (legacy behavior), generic
`graphdone:1001`, and self-host `node:1000`. This does not claim API non-root
hardening. Generic's existing UID is preserved for existing data owners.
Self-host now defaults to `NODE_ENV=production` even outside Compose. Production
HTTP/HTTPS Compose auth volumes target the actual server working directory,
`/app/packages/server/data`; the previous `/app/data` target did not persist the
store used by the process. No existing volumes are migrated or deleted here.

## Acceptance and negative evidence

Three clean final images passed `tests/runtime/run-image.mjs IMAGE EXPECTED_UID`.
The runner checks the actual image configuration/default command, missing-secret
failure without network access, installed consumer resolution (including SDK
subpaths/root imports), absent tools/tests, runtime UID and native SQLite.

Each image then starts its compiled API against an explicitly owned loopback
Neo4j fixture and private named auth volume. The test rejects missing/replayed
CAPTCHA, solves a real production challenge, signs in, creates an owned graph,
uses the compiled MCP stdio process to create/read a node, observes it through
GraphQL, updates it through GraphQL and verifies MCP plus independent database
readback. Protocol errors and cleanup failures fail. Replacing the container
while retaining only its named volume must preserve the exact SQLite account ID.
The entire real boundary contract passes again after replacement. Owned graphs,
containers and named volumes are removed strictly by the runner.

Retained failures:

- The old full-dependency API image fails the actual installed-tool inventory.
- The first reduced image fails real ESM startup on missing `graphql-tag`.
- Preliminary review caught the shell-based administrator check and proposed
  generic UID drift before acceptance. The final source removes the redundant
  shell call and preserves existing identities.
- Initial inventory drafts incorrectly treated `typescript-memoize` as the
  compiler and resolved the MCP SDK's nonexistent root entry. The corrected
  contract checks exact tool names and actual exported consumer subpaths; it
  still launches the real compiled API/MCP processes.

Local clean host install, all-package typecheck/lint and harness 192/192 pass.
The affected server suite passes 211/211. Docker builds compile all relevant
packages. Existing lint/bundle warnings remain. These checks use owned Linux
fixtures, not a public deployment, Windows test or historical-volume migration.

## Actual image and scanner provenance

Final local manifest digests:

| Image | Manifest digest | Runtime UID |
| --- | --- | --- |
| API | `sha256:4deb93462ed64371cc64a425f099449ad7561f3e4df2a46f336658b44caa8a00` | 0 |
| Generic | `sha256:43202783142bbde44333518f451e39b67495a06ffa25ee783871f7c9c81b4535` | 1001 |
| Self-host API | `sha256:8d464a8965e84b815e0c5172ccac982b9942a50b07a474e5dac83ce72c637ea4` | 1000 |

The inventory records 393 named manifests per image, including module entrypoint
manifests without versions; this is not a distinct-package or exploit count.
Trivy reports 377 Node package entries per image. It also records 28 Alpine OS
packages or 88 Debian OS packages. Separate counting schemes are not conflated.

Scanner: Trivy 0.76.1, immutable scanner image
`aquasec/trivy@sha256:790fd66d1697395d8693d1acaa1ea702406a20f109b6fc7bac8db623eca6c06c`.
DB version 2, updated2026-10-27T19:17:44.708952708Z and downloaded23:01:37Z.
Scanner containers receive only the owned image archive and dedicated cache;
no Docker socket, credentials or broad workspace mounts are required.

Commands use `docker save` and `trivy image --input ... --scanners vuln
--list-all-pkgs --format json`. Full JSON and DB metadata are retained under the
owned dated evidence directory and by the new required CI image matrix. Scans
are inventories of known findings in supported analyzers, not proof of absence
of vulnerabilities or of package reachability.

| Final scan | OS findings | npm findings |
| --- | ---: | ---: |
| Alpine API | 0 | 0 |
| Alpine generic | 0 | 0 |
| Debian Bookworm self-host API | 228 | 0 |

Bookworm initially reported 229 OS entries. Upgrading tzdata from 2026c to
2026e-0+deb12u1 removes the one entry with an available distro fix. The final raw
inventory retains 1 critical, 56 high, 87 medium, 83 low and 1 unknown; statuses are
170 affected, 17 will_not_fix and 41 fix_deferred. These counts are not distinct
reachable exploits. Base-OS triage is tracked separately under #209.

The critical raw entry, CVE-2023-45853 on zlib1g 1:1.2.13.dfsg-1, concerns MiniZip.
[Debian's primary assessment](https://security-tracker.debian.org/tracker/CVE-2023-45853)
states the affected contrib/minizip component is not built for Bookworm's package.
Actual `dpkg-query -L zlib1g` lists libz.so.1.2.13; no minizip/libminizip1 package
is installed. This specific applicability evidence does not dismiss other
findings or alter the raw scan. [Debian tzdata inventory](https://security-tracker.debian.org/tracker/source-package/tzdata)
identifies the installed security update.

## CI and remaining limits

The required `Runtime Images` matrix builds each final image and runs the same
real contract, including replacement-container recovery. `CI Success` rejects
failed/skipped matrix outcomes. The inventory step requires valid OS and Node
package evidence and retains all findings; it is deliberately not represented
as a zero-vulnerability policy. Final exact-head review and CI remain required.

Turbo/Mermaid tooling updates, base-OS remediation/applicability review, historical
mis-mounted data recovery, hosted acceptance and main/release/deployment clearance
are unfinished. Existing TLS mount semantics are preserved; these local image
contracts exercise HTTP API behavior and do not replace production TLS acceptance.
