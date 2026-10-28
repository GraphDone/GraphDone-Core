# Development launch must declare its mode before authentication policy is read

On 2026-10-27, [PR #195 CI run40573347298](https://github.com/GraphDone/GraphDone-Core/actions/runs/40573347298)
failed every basic smoke case at authentication on source
`8c9712b7bda0c7515568c08bae710be4bea675a1` (merge composition
`2b16ba2e2318e765883c1fd5ef312a0445addec2`). The sequence reported0 passes,
6 failed cases plus its failed-process evidence row. Trace inspection, with
credentials/tokens omitted, showed `/config` requiring all five CAPTCHA actions,
GraphQL `Please complete verification and try again`, then the existing
password-attempt limiter returning429 after repeated quick-login attempts.
The dedicated production proof/browser tests had passed and did not cover this
development launch contract.

Cause: CI invokes `npm run dev` without a `.env` or explicit `NODE_ENV`.
The API's old dev command launched `src/index.ts` directly, leaving mode unset.
CAPTCHA deliberately requires proof in unknown modes, while developmentInfo
advertised default-account shortcuts in every non-production mode. Changing
that policy to treat unknown mode as optional would mask the mismatch.

Correction: the explicit dev command launches `src/dev.ts`. It first loads and
validates environment configuration, defaults only an absent mode to
`development`, then dynamically imports the API. Explicit production, unknown
and blank modes are preserved. Development shortcuts are advertised only for
explicit development/test modes. Production `start` still imports the normal
API directly, and production/unknown CAPTCHA remains required.

Validation on Node22.18.0: six entry-point controls plus nine production startup
and nine CAPTCHA controls passed (24/24); server typecheck/build passed. An
owned invocation of the actual npm dev command with `NODE_ENV` unset, an empty
owned server data directory, disposable Neo4j and separate loopback ports
reported only magic-link/forgot-password/reset-password as required actions.
The existing browser smoke suite passed6/6 headed, one worker, zero retries,
2.3 minutes. This exercised actual quick login rather than a stubbed frontend.

The first entry test incorrectly used Vitest1's `stubEnv(undefined)`, which
created the literal string `undefined`; its cached mocked API factory also did
not rerun after `resetModules`. Correct fixtures delete the variable explicitly
and reset the mock factory. Those six fixture failures are retained separately
from the real CI failure. Assertions, challenge difficulty, login budgets and
CI thresholds were not relaxed. Final full server/harness and exact-head CI
results remain in the PR discussion; no deployment or hosted result is claimed.

Corrective rule: make the launch command's mode explicit without overwriting
operator configuration, then test that command as well as isolated policy.
Keep unknown-mode policy fail closed and record failed mode/shortcut alignment
as an application regression, not merely a flaky test retry.
