# Security coverage and remaining work from the October 23 sweep

This is a bounded source/dependency review of Core snapshot `6b2a007f8810c4ec08fccb3df83cc01cd44804d7`, plus the scoped lint dependency correction described below. It does not establish the security or deployed revision of graphdone.com. Folder authorization ([PR #160](https://github.com/GraphDone/GraphDone-Core/pull/160)), queued-save ownership ([PR #158](https://github.com/GraphDone/GraphDone-Core/pull/158)), and test evidence ([PR #159](https://github.com/GraphDone/GraphDone-Core/pull/159)) have separate, narrower evidence.

## Dependency inventory and reachability

On 2026-10-23, Node 22.23.4/npm 10.8.2 ran `npm audit --package-lock-only --json` against the snapshot's unchanged manifests and lockfile in a temporary directory. It reported **23 affected package entries: 3 critical, 7 high, 11 moderate, 2 low**. `npm audit --omit=dev --json` reported **8 moderate, 0 high, 0 critical**. These are package-tree counts, including inherited findings, not 23 distinct exploitable defects. Earlier counts of 22 are not the result of this dated run.

| Family | Observed surface | Priority and next validation |
| --- | --- | --- |
| React Router 6.30.6: two production entries | Browser runtime. Inspected `Link`/`navigate` destinations are literals or fixed navigation arrays. The app uses `createRoot` + `BrowserRouter`, not server hydration. No attacker-controlled navigation path or SSR sink was found in that search. | **P2:** migrate through a dedicated router PR to a patched release, testing redirects, route guards, login callbacks, and mobile navigation. The [navigation advisory](https://github.com/advisories/GHSA-wrjc-x8rr-h8h6) still applies to the installed version; source inspection is not proof that every future caller is safe. |
| UUID 9.0.1 and two inherited Apollo federation entries | Server dependency. Inspected application imports call `v4()` without an output buffer. The [advisory](https://github.com/advisories/GHSA-w5hq-g745-h8pq) concerns buffered v3/v5/v6 calls; no such application call was found. | **P2:** review a UUID update to at least 11.1.1 and compatible upstream federation updates; test CJS/ESM startup, schema generation, and generated IDs. Do not force the audit-suggested latest major across every consumer without that review. |
| Tailwind 3.4.19, postcss-nested, selector parser: three production-classified entries | CSS build pipeline (`packages/web/postcss.config.js`), not an observed request-time CSS parser. Tailwind is currently declared in production dependencies. | **P2:** resolve the [selector parsing advisory](https://github.com/advisories/GHSA-rj75-hqrm-r3gf) through a compatible upstream update or a separately validated migration. Moving a declaration to devDependencies changes the count, not the vulnerable code. Validate generated styles and responsive views. |
| Vite/vite-node/esbuild: three additional entries, including one high | Development server and test tooling. `packages/web/vite.config.ts` binds Vite to `0.0.0.0`; access depends on deployment/network configuration. Production web Docker uses built assets in nginx. | **P1 for exposed development servers:** isolate access and upgrade Vite in a dedicated toolchain PR, including editor endpoints, path handling, and dev proxy checks. Several [editor endpoint conditions](https://github.com/advisories/GHSA-r825-w8mm-5pxw) depend on OS/editor configuration. No live attack or deployed exposure was tested. |
| Vitest/coverage/tinypool: three additional critical entries | Test execution. Configured commands use `vitest --run`; no Vitest UI/API listener configuration was found. The [Vitest issue](https://github.com/advisories/GHSA-5xrq-8626-4rwp) requires UI/API/browser-mode conditions; [tinypool](https://github.com/advisories/GHSA-85c8-ppgw-ccpr) requires a prototype-pollution prerequisite. No application import of these tools was found. | **P2, P1 if exposed UI is used:** upgrade Vitest, coverage, and worker dependencies together. Validate real suite discovery, reporters, skips, worker cleanup, and coverage; do not replace the worker major beneath Vitest 1 without compatibility evidence. |
| Root TypeScript-ESLint/minimatch: six additional high entries | Lint path/glob processing, not a public application API. Root parser 6.21.0 pins minimatch 9.0.3. | **Corrected in this follow-up:** narrowly override this parser's minimatch to 9.0.7. The [nested-extglob issue](https://github.com/advisories/GHSA-23c5-xmqv-rm74) was reproduced in a bounded child process. |
| Turbo: one additional moderate entry | Local build/test orchestration. The repo uses npm; no Turbo remote-cache login flow was reviewed. | **P2:** separate Turbo migration, including pipeline configuration and cache provenance. Its [repository-detection issue](https://github.com/advisories/GHSA-3qcw-2rhx-2726) concerns local tool execution; it is not evidence of a public web route. |
| Mermaid/KaTeX: two additional low entries | Mermaid is loaded by the project-transfer browser test. Application code exports diagram text; no application Mermaid renderer was found. | **P3:** update the test renderer in a scoped PR and rerun diagram export/render tests, retaining strict rendering settings. |

The server and generic Dockerfiles currently install/copy development dependencies too. A development-classified package can therefore exist in a server image without being loaded by the API. The production-only audit gate does not audit the complete image or establish runtime reachability.

## Narrow correction and checks

Correction commit: `1a53279cdb96130f5c3e0af93a6502964a48ab1f`. The override applies only to `@typescript-eslint/typescript-estree@6.21.0`; other parser and matcher majors remain unchanged. The lockfile changes only that matcher and its brace-expansion dependencies. A clean `npm ci --legacy-peer-deps` completed on Node 22.23.4.

- `tests/lib/dependencies/minimatch.test.mjs` uses the matcher's actual parser-relative resolution. The same test against 9.0.3 fails at its two-second child-process deadline; 9.0.7 completes and preserves positive/negative source-file selection.
- `npm run test:unified:lib`: **106 passed**, including the new dependency regression.
- `npm run lint`: **zero errors**, existing warnings remain.
- `npm run test`: **434 passed** across the four packages; **25 database-gated cases skipped**. The command also built all packages. This is the runtime snapshot's suite, not the combined folder/durability branch's larger suite.
- After correction, `npm audit --package-lock-only --json`: **17 entries: 3 critical, 1 high, 11 moderate, 2 low**. The six-entry lint chain is removed. Production findings remain the same eight moderate entries.

## Remaining authentication work

These are separate follow-ups, not fixes delivered by a dependency audit. Priorities describe remediation order, not independently assigned CVSS scores.

| Priority | Evidence at the reviewed snapshot | Required fix and meaningful negative test |
| --- | --- | --- |
| **P1: CAPTCHA and password-login abuse controls** | `utils/captcha.ts:13` accepts any matching six-character string; an isolated direct call returned true for a synthetic value. `resolvers/sqlite-auth.ts:325` makes CAPTCHA optional on password login. `/graphql` has no password-login limiter; the REST email-request limiters are separate. The older localStorage lockout is a UI feature. | Require a server-verified challenge where policy calls for one, with bounded per-account/IP password attempts that also cover GraphQL aliases. Test direct API requests without browser state, arbitrary codes, and repeated aliased attempts. This is an abuse-control gap, not evidence that CAPTCHA alone grants an account session. |
| **P1: single-use magic links** | `auth/sqlite-auth.ts:1307` selects unused tokens, then queues an unguarded update at line 1313. A real in-memory SQLite probe verified the same fixture token concurrently: **2 successful verifications**. No shared DB was touched. | Atomically consume an unexpired, unused token and check the affected row before issuing identity. Require exactly one success under concurrent requests; test expiry, repeat use, account deactivation, and transaction failure. |
| **P1 when defaults are configured: signing/session secrets** | `utils/auth.ts:3` and `index.ts:151` retain known fallback secrets. No production startup rejection was found. Installer generation of secrets does not cover every launch path. | Reject missing/default secrets for production and validate installer/container/direct startup. No deployed secret values were inspected or reported. |
| **P2: token purpose and account lifecycle** | Login and password reset share `createMagicLink`/`verifyMagicLink`; reset consumes it at `index.ts:886`. Magic-link verification does not itself require the account to be active. | Bind tokens to purpose and validate current account state on each authentication path. Test reset-versus-login cross-use, disabled accounts, and revocation across password, magic-link, and OAuth sessions. HTTP exploitation was not exercised in this sweep. |
| **P2: OAuth account linking** | Configured strategies read provider email (`auth/oauth-strategies.ts:17,57,93`); `findOrCreateUserFromOAuth` links an existing email at `auth/sqlite-auth.ts:1148` without a verified-email precondition in that helper. | Review each provider's verified-email contract and require proof before automatic linking. Test unverified/missing email and an existing account. No live provider callback or account takeover was attempted. |

Follow-up implementation on 2026-10-23: [PR #169](https://github.com/GraphDone/GraphDone-Core/pull/169), commit `7e91d1a59c9ae9051569d8ef711ef6619f921bd6`, adds guarded, awaited single-use consumption and inactive-account rejection. Its real SQLite negative controls failed before the fix; all eleven magic-link cases and 39 server tests pass afterward, including expiry during a delayed write, replay, and database errors. The expiry predicate uses SQLite execution time after a controlled delayed-write negative control exposed the earlier timestamp boundary. Independent review and integrated validation remain pending. The baseline observations above remain historical evidence; this proposed fix does not separate login/reset token purpose or establish general session revocation.

Source locations are relative to `packages/server/src/` and anchored to the snapshot above. Local, secret-free evidence is under `/tmp/graphdone-residual-*-audit.json`, `/tmp/graphdone-minimatch-*.log`, and `/tmp/graphdone-residual-auth-probe.log`; the latter reports only `parallelMagicLinkSuccesses: 2` and `arbitraryCaptchaAccepted: true`.

## CSS advisory reconciliation on 2026-10-27

The historical three CSS entries above remain the result of the October 23
inventory. On October 27, the [official advisory](https://github.com/advisories/GHSA-rj75-hqrm-r3gf)
lists parser 6.1.5 and 7.1.6 as patched; affected ranges are `<6.1.5` and
`>=7.0.0 <7.1.6`. Its metadata was updated on October 26 and it is not withdrawn.
Live dev `8712389` already locks parser 6.1.5 for Tailwind 3.4.19 and
postcss-nested 6.2.0, the same parser resolution present in `36c02c0` on October 23.
The fresh-cache production audit has no CSS-chain finding. This follow-up does
not alter any dependency declaration, lockfile or production/dev classification.

The dedicated guard checks every locked parser path and both actual CSS
consumers. Semantic tests preserve flat and nested selectors and generated
responsive Tailwind utilities; they are not a timing benchmark. This resolves
the named advisory for the current locked chain, without forcing a Tailwind
migration. Keep earlier audit counts as dated observations and do not infer a
cache cause. The [canonical lesson](../../.agents/inbox/2026-10-27-reconcile-advisory-backports-with-locked-consumers.md)
records commands, sources and limits. Final build/browser/CI evidence belongs
to the separate CSS review. Router, UUID and toolchain work remain separate.

## Coverage still needed

The folder tests do not establish all generated Graph/WorkItem/Edge permissions, concurrent deletion integrity, MCP/agent grant revocation, share-link scopes, session/cookie policy, uploads, backups, email delivery, or deployed proxy controls. Those need isolated contracts and user-level tests with current roles, multiple accounts, races, and negative cases. Dependency counts, passing smoke tests, and absence of a discovered source sink are separate pieces of evidence; none is a full security assessment.
