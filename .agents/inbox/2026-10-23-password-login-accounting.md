# Reserve failed-login capacity before awaiting password verification

On 2026-10-23, the baseline `5f0f454` password resolver allowed direct GraphQL
guesses despite the browser's attempt tracker. The initial command
`vitest run packages/server/tests/password-login-limits.test.ts --config packages/server/vitest.config.ts`
reported seven failed tests and one passing successful-login test. After the
server-side correction, the expanded resolver and accounting suites passed all
16 tests using real in-memory SQLite and an owned loopback HTTP fixture.

Cause: browser state and unrelated REST route limits did not cover password
login. Counting failures only after asynchronous verification would also allow
concurrent attempts to exceed the intended budget.

Corrective rule: reserve capacity before expensive work, settle it exactly
once, key known accounts by canonical identity, and retain an independent IP
budget across successful logins to other accounts. Bound the tracking maps,
keep blocked keys until expiry, and test direct API aliases and concurrent
calls without relying on browser storage.

Policy, evidence, and limits are in the canonical
[password-login review](../../docs/quality/PASSWORD_LOGIN_LIMITS_2026-10-23.md).
This is per-process accounting, not distributed protection; the CAPTCHA and
other authentication gaps remain separate work.
