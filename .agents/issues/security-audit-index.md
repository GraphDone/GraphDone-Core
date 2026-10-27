# Security audit symptom index

| Symptom | Evidence and corrective rule |
| --- | --- |
| Green production audit hides development-tool findings or package counts are treated as exploit counts | [Audit scope lesson](../inbox/2026-10-23-dependency-audit-scope.md); [dated security scope](../../docs/quality/SECURITY_SCOPE_2026-10-23.md) |
| Nested lint glob stalls the process | `tests/lib/dependencies/minimatch.test.mjs`; scoped parser matcher override and bounded child-process regression |
| A fresh audit reports Zod high severity after an earlier green scan; bounded collections still walk rejected elements | [Zod consumer and bounded-validation lesson](../inbox/2026-10-23-zod-constrained-collections.md); recheck the resolved SDK dependency and use an isolated audit cache without inferring why older metadata differed |
| Browser login lockout is mistaken for server throttling; one-use email token succeeds concurrently | [Remaining authentication work](../../docs/quality/SECURITY_SCOPE_2026-10-23.md#remaining-authentication-work) |
| A federation upgrade removes UUID findings but breaks Neo4j schema generation; an override leaves the old lock resolution | [Validate federation consumers and installed UUID paths](../inbox/2026-10-27-federation-consumers-bound-uuid-upgrades.md); `tests/lib/dependencies/uuid.test.mjs` |
