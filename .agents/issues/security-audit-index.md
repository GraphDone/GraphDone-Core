# Security audit symptom index

| Symptom | Evidence and corrective rule |
| --- | --- |
| Turbo or Mermaid major upgrades clear advisories but can change environment, cache, dependency placement or rendering | [Executed consumer evidence](../inbox/2026-10-27-tool-upgrades-need-executed-consumer-evidence.md); [scoped migration and negative controls](../../docs/quality/REMAINING_TOOLING_2026-10-27.md) |
| A toolchain upgrade changes test counts, loses matcher types or drops unimported coverage | [Preserve discovery and consumer behavior](../inbox/2026-10-27-toolchain-upgrades-must-preserve-test-contracts.md); [migration evidence](../../docs/quality/TOOLCHAIN_MIGRATION_2026-10-27.md) |
| OAuth email metadata loses verification or callbacks log credential-bearing redirects | [Provider proof and isolated atomic linking](../inbox/2026-10-27-oauth-linking-needs-provider-proof-and-atomicity.md); [provider/recovery contract](../../docs/quality/OAUTH_IDENTITY.md) |
| Login and reset links cross-use, or a reset/reactivation revives old sessions | [Bind purpose and session revision at the write](../inbox/2026-10-27-email-purpose-and-revision-are-auth-boundaries.md); real SQLite/HTTP/WebSocket `auth-link-boundary.test.ts` |
| CAPTCHA validates only a client string's format or skips missing GraphQL proof | [Server policy, signed action/expiry and bounded replay](../inbox/2026-10-27-captcha-proof-must-be-server-issued.md); `packages/server/tests/captcha*.test.ts`, `qc:captcha` |
| Historical CSS audit findings disappear while the lock is unchanged | [Reconcile official backport ranges with actual consumers](../inbox/2026-10-27-reconcile-advisory-backports-with-locked-consumers.md); locked-path and Tailwind/parser regressions |
| Router advisory requires a major update and older upstream navigation expectations differ | [Installed consumer and route compatibility](../inbox/2026-10-27-router-upgrades-need-current-consumer-contracts.md); every locked Router path plus desktop/phone route gates |
| Fresh production audit flags Undici through optional SQLite build tooling without a direct application import | [Trace the native-build consumer and patch its actual resolved copy](../inbox/2026-10-24-undici-native-build-dependency.md); `tests/lib/dependencies/undici.test.mjs` rejects affected locked and installed consumer versions |
| Green production audit hides development-tool findings or package counts are treated as exploit counts | [Audit scope lesson](../inbox/2026-10-23-dependency-audit-scope.md); [dated security scope](../../docs/quality/SECURITY_SCOPE_2026-10-23.md) |
| Nested lint glob stalls the process | `tests/lib/dependencies/minimatch.test.mjs`; scoped parser matcher override and bounded child-process regression |
| A fresh audit reports Zod high severity after an earlier green scan; bounded collections still walk rejected elements | [Zod consumer and bounded-validation lesson](../inbox/2026-10-23-zod-constrained-collections.md); recheck the resolved SDK dependency and use an isolated audit cache without inferring why older metadata differed |
| Browser login lockout is mistaken for server throttling; one-use email token succeeds concurrently | [Remaining authentication work](../../docs/quality/SECURITY_SCOPE_2026-10-23.md#remaining-authentication-work) |
| A federation upgrade removes UUID findings but breaks Neo4j schema generation; an override leaves the old lock resolution | [Validate federation consumers and installed UUID paths](../inbox/2026-10-27-federation-consumers-bound-uuid-upgrades.md); `tests/lib/dependencies/uuid.test.mjs` |

Runtime image pruning and actual OS/npm inventories: [2026-10-27 consumer/persistence lesson](../inbox/2026-10-27-runtime-images-need-installed-consumer-proof.md), [image provenance and residuals](../../docs/quality/RUNTIME_IMAGE_PACKAGING_2026-10-27.md).

| A fresh unchanged-source audit reports GraphQL Scalars or Hono node-server | [Remove unused code and validate the actual installed consumer](../inbox/2026-10-28-advisories-follow-installed-consumers.md); isolated static-path negative and Neo4j scalar contract |
