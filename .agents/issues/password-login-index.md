# Password-login failure symptom index

| Symptom | Evidence and corrective rule |
| --- | --- |
| Browser lockout exists but direct or aliased GraphQL guesses continue | [Password-login accounting lesson](../inbox/2026-10-23-password-login-accounting.md) |
| Concurrent requests exceed a failed-attempt budget | Reserve in-flight capacity before awaiting verification; see [policy and regression evidence](../../docs/quality/PASSWORD_LOGIN_LIMITS_2026-10-23.md) |
| Successful logins reset an attacker-controlled IP's failure history | Refund successful attempts without clearing unrelated IP failures; covered by the real-SQLite resolver tests |
