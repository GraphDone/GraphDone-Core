# Client-side puzzle completion is not a server-verifiable authentication proof

Date: 2026-10-27. Searched the symptom/security indexes and the October 23
security inventory before addressing #183. The existing helper accepted any
six uppercase alphanumeric characters; login/signup also skipped the helper
when a payload was omitted. Correct credentials remained necessary for password
login: this was an abuse-control bypass, not proof of account takeover.

## Reproduction and correction

With Node 22.18.0 / npm 10.8.2 in an owned worktree based on
`ef495eff15ed7aac51e72dc7a1db1bb96d2b3695`:

```sh
npm run test -w @graphdone/server -- tests/captcha.test.ts --maxWorkers=1 --minWorkers=1
# Before: arbitrary code ABC123 was accepted; the new rejection assertion failed.
```

The corrected policy requires proof for production login/signup and for Core
magic-link, forgot-password and reset-password requests in every mode. Missing
proof is allowed only for login/signup in explicit development/test mode to
retain development quick login. Supplied proofs are always verified. Guest
access retains its existing separate policy; OAuth callbacks and email-code
verification are not reclassified as these challenge actions.

The existing installed `altcha-lib@1.4.1` / `altcha@2.3.0` protocol is retained;
no dependency upgrade or provider account is added. The server issues signed
SHA-256 challenges with a five-minute expiry and action. A bounded ledger
authenticates the exact issued salt/signature/action, validates the solution,
rechecks expiry after asynchronous verification and atomically consumes it.
At most 5,000 outstanding/pending challenges are admitted; concurrent issuance
reserves capacity before awaiting cryptography. Live proofs are not evicted to
admit more work. Challenge issuance is limited to 30/minute per observed socket
IP (IPv6 normalized); forwarded headers do not redefine Core's trust policy.

An unset key generates a random process-local signing key. Explicit keys must
be at least 32 characters; the old public fallback is rejected, including at
production startup. Outstanding challenges intentionally fail after restart.

## Evidence

- Original failure retained in `captcha-before.log` under the owned temporary
  resolution evidence directory.
- All 139 server tests passed, including nine helper/policy negatives, three
  real HTTP GraphQL/SQLite tests, existing password/IP/alias-concurrency tests,
  and production startup's fallback-key rejection.
- Three UI component tests cover proof invalidation, action/reset, failed policy
  loading and accessible retry. Policy fetch failure never becomes success.
- Four headed browser cases passed through the built frontend served by nginx
  and a production-mode API: direct REST/GraphQL omission/forgery rejection;
  390px/1440px real worker-solved proof, failed password then new-proof success;
  and policy-load failure with keyboard retry. No email was delivered.
- Clean install, types and build passed; lint passed before the final explicit
  socket-IP key generator, whose final composed checks remain to be recorded.
- Earlier browser failures are retained: the test initially forgot to choose
  the Password tab; `.check()` incorrectly expected a PoW checkbox to become
  checked before asynchronous solving; reusing the same API process exhausted
  its existing strict rate limit. The corrected test clicks, waits for verified
  status and asserts checked state, against a fresh owned API process. Limits
  were not weakened. Initial Vite invocation from the wrong cwd omitted styles;
  final evidence uses the built artifact through nginx.

The browser uses the self-host nginx configuration with only its listener and
API upstream replaced for isolated loopback ports (28548 / 28537). Neo4j/APOC
and SQLite fixtures are owned; the user's localhost application is untouched.
Local traces can include synthetic fixture credentials and remain private.

## Corrective rule and limits

Enforce challenge policy at each server action, including direct GraphQL aliases
and the auth-only schema. Client disabling/hiding controls is not enforcement.
Clear consumed/expired proofs and provide a keyboard-accessible retry. Preserve
backend contracts explicitly: Core advertises ALTCHA through `/config`; Cloud's
existing contract remains separate and is not proven by these tests.

This is a bounded proof-of-work abuse control, not proof that a visitor is human.
The ledger/rate limits are process-local; multiple API instances require a
shared or sticky challenge contract before availability parity can be claimed.
Unresponsive, restarted or over-capacity verification fails closed. Email token
purpose, OAuth linking and reset-session revocation remain #184. Hosted parity,
distributed limits, release/deployment and actual email delivery remain separate
work. Independent exact-head review and final CI are still required.
