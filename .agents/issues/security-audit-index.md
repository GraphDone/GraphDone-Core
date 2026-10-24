# Security audit symptom index

| Symptom | Evidence and corrective rule |
| --- | --- |
| Fresh production audit flags Undici through optional SQLite build tooling without a direct application import | [Trace the native-build consumer and patch its actual resolved copy](../inbox/2026-10-24-undici-native-build-dependency.md); `tests/lib/dependencies/undici.test.mjs` rejects affected locked and installed consumer versions |
| Green production audit hides development-tool findings or package counts are treated as exploit counts | [Audit scope lesson](../inbox/2026-10-23-dependency-audit-scope.md); [dated security scope](../../docs/quality/SECURITY_SCOPE_2026-10-23.md) |
| Nested lint glob stalls the process | `tests/lib/dependencies/minimatch.test.mjs`; scoped parser matcher override and bounded child-process regression |
| A fresh audit reports Zod high severity after an earlier green scan; bounded collections still walk rejected elements | [Zod consumer and bounded-validation lesson](../inbox/2026-10-23-zod-constrained-collections.md); recheck the resolved SDK dependency and use an isolated audit cache without inferring why older metadata differed |
| Browser login lockout is mistaken for server throttling; one-use email token succeeds concurrently | [Remaining authentication work](../../docs/quality/SECURITY_SCOPE_2026-10-23.md#remaining-authentication-work) |
