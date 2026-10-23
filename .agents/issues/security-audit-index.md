# Security audit symptom index

| Symptom | Evidence and corrective rule |
| --- | --- |
| Green production audit hides development-tool findings or package counts are treated as exploit counts | [Audit scope lesson](../inbox/2026-10-23-dependency-audit-scope.md); [dated security scope](../../docs/quality/SECURITY_SCOPE_2026-10-23.md) |
| Nested lint glob stalls the process | `tests/lib/dependencies/minimatch.test.mjs`; scoped parser matcher override and bounded child-process regression |
| Browser login lockout is mistaken for server throttling; one-use email token succeeds concurrently | [Remaining authentication work](../../docs/quality/SECURITY_SCOPE_2026-10-23.md#remaining-authentication-work) |
