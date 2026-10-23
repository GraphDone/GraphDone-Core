# Consume single-use identity tokens with a guarded database update

On 2026-10-23, real in-memory SQLite regressions on runtime base `5f0f454` reproduced concurrent magic-link replay and inactive-account acceptance. The selected before-fix run failed two cases and passed one. A further controlled delayed-write regression failed against the first fix `4f4b782` because its expiry timestamp was captured before the statement executed. The final full server run passed 39 cases, including all eleven new magic-link cases. Commands and evidence are recorded in the [review note](../../docs/quality/MAGIC_LINK_REPLAY_2026-10-23.md).

Cause: selecting an unused token does not reserve it. The previous update neither checked unused/expiry state again nor waited for its outcome before returning identity.

Corrective rule: atomically transition unused state using the database's execution-time expiry predicate, await completion, and require exactly one affected row before returning or creating identity. Check current account activity. Exercise real concurrent requests, expiry boundaries, and actual database failures; mock success callbacks alone cannot establish single-use behavior.

Limits: this shared verifier still serves both login and reset flows. Purpose separation, other authentication controls, and deployed HTTP/email behavior remain separate work. A failure after successful consumption deliberately requires a fresh link. No shared database or deployed secrets were used.
