# Password failures need server-side accounting on each login resolver call

Date: 2026-10-23. Baseline: `5f0f454`. Tracking:
[Core validation sweep #156](https://github.com/GraphDone/GraphDone-Core/issues/156).

## Incident and correction

The password login resolver previously accepted repeated guesses without a
server-side attempt limit. Browser localStorage lockout did not constrain direct
GraphQL clients, and the separate REST email-request limiter did not cover this
resolver. Seven of the first eight new real-SQLite/GraphQL regressions failed on
the baseline; the repeated-success case already passed.

The resolver now reserves an IP slot before looking up the account and an
account slot before password verification. Reservations count while work is in
flight, preventing concurrent requests from all passing a check before their
failures are recorded. Every invoked login field is charged independently of
its GraphQL operation name or alias. The schema's non-null login field can stop
the remaining aliases after an error; aliases in later requests still share
the same accounting.

## Selected policy

| Scope | Policy |
| --- | --- |
| Account | At most five failed or in-flight password-login attempts in a fixed 15-minute window. Known accounts use the SQLite user ID, so email, username, and casing share one budget. Unknown identifiers are normalized. |
| IP | At most 20 failed or in-flight attempts in a fixed 15-minute window across accounts. Express `req.ip` or the connection address supplies the key; this code never reads forwarded headers directly. The installed `ipKeyGenerator` groups IPv6 addresses by /56 and normalizes IPv4-mapped addresses. |
| Success | Refund the reservation and clear that account's earlier failures. Do not clear the IP's failures for other accounts. Repeated successful sequential logins do not exhaust either budget. |
| Failure | Wrong passwords, unknown accounts, disabled-account rejection, and failed optional CAPTCHA verification consume capacity. Account-limit rejection also consumes an IP failure, limiting repeated blocked-account lookups. Internal storage/signing failures release reservations without charging a credential failure. |
| Recovery | Once a budget is exhausted, even a correct password waits for its window to expire. Responses use HTTP 429 and GraphQL `RATE_LIMIT_EXCEEDED`, `retryAfter` seconds, and `rateLimitExceeded: true`. No account is permanently disabled. |
| Storage | At most 10,000 account keys and 10,000 IP keys per process. Keys are hashed to bound their stored size. Successful empty entries are removed; expired idle entries are swept lazily. At capacity, new keys fail closed without evicting an existing blocked key. Pending entries survive expiry until they settle. |

The fixed window starts when a bucket is first reserved. Successful empty
buckets are discarded. Late failures are charged to the current window, while
in-flight slots remain reserved across a window boundary. Settlement is
idempotent, so cleanup cannot refund the same slot twice.

## Evidence

`packages/server/tests/password-login-limits.test.ts` uses the actual resolver,
auth-only GraphQL schema, bcrypt password verification, and real in-memory
SQLite. A separate loopback HTTP listener is allocated on an OS-selected port
for the Apollo HTTP check. No deployed or shared database is used.

The tests cover direct HTTP 429 responses, aliases, changing account identifiers
and source IPs, concurrent failures, unknown-account spraying, untrusted
forwarded headers, IPv6 rotation, expiry/recovery, internal storage errors,
and 45 consecutive successful logins without browser storage.

`packages/server/tests/password-login-limiter.test.ts` covers bounded storage,
capacity rejection, expiry, in-flight reservations, double settlement,
concurrent successful/failed attempts, IPv4-mapped IPs, and missing-IP fallback.
The two focused files passed all 16 cases after the change. Commands:

```bash
npm run test --workspace @graphdone/server -- tests/password-login-limits.test.ts tests/password-login-limiter.test.ts
npm run typecheck --workspace @graphdone/server
```

A fresh isolated `npm ci --legacy-peer-deps` on Node 22.23.4 completed. The full
server suite then passed all 44 tests; server typecheck and lint passed with
zero errors, and `git diff --check` passed. Existing lint warnings remain.

## Limits and remaining work

Accounting is in process memory. Restarting a process clears it, and multiple
replicas do not share budgets. A distributed deployment needs a shared atomic
store or equivalent gateway controls, plus tests spanning replicas. Shared
NATs or IPv6 prefixes share a failure budget. A caller with no valid IP context,
including the current WebSocket context, shares a bounded unknown-IP bucket.
Correct proxy trust configuration remains necessary; accepting arbitrary
forwarded addresses at the proxy would undermine per-IP attribution.

An attacker can deliberately exhaust a known account's temporary budget or
tracking capacity. These controls bound guessing and storage; they do not
replace broader abuse protection or prevent denial of service. Parallel valid
logins can be temporarily limited while their reservations are pending.

This change does not fix the optional/synthetic CAPTCHA path, token purpose,
magic-link races, OAuth account linking, fallback signing secrets, signup
limits, or other authentication entry points. Those require separate reviewed
changes and evidence. The database fixture and loopback API checks do not
establish production deployment parity.
