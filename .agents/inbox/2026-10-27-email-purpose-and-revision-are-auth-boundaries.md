# Bind email link purpose and session revision at the database write

On 2026-10-27, #184 token work started from the reviewed CAPTCHA composition
`8c9712b7bda0c7515568c08bae710be4bea675a1`, containing dev `32149ee`.
The two production email redemption handlers were extracted without changing
their behavior, then exercised through owned HTTP and real in-memory SQLite.
`npm run test -w @graphdone/server -- tests/auth-link-boundary.test.ts
--maxWorkers=1 --minWorkers=1` failed both negative controls: a reset link
produced a login JWT, and a login link completed password reset with HTTP200.
No token values or deployed credentials are included in this record.

Cause: both routes consumed the same untyped token, and changing a password
changed neither existing JWT authority nor other outstanding links. A standalone
select/consume followed by password update cannot supply the desired reset
atomicity. Carry purpose, account identity and revision in the issuance record,
and evaluate them with execution-time expiry in the conditional SQLite write.
Increment the account revision with the password and revoke links through a
trigger in the same statement. Compare JWT revision with the current active
account on HTTP and WebSocket boundaries; never refresh a stale authorization
snapshot into the new revision.

The implementation and migration contract are in
[the authentication lifecycle document](../../docs/quality/AUTH_LINK_LIFECYCLE.md).
Legacy untyped links are invalidated; old signed JWTs map to revision zero and
remain revocable. The existing inactive-account test exposed
`SQLITE_ERROR: no such column: deactivationDate` when it first exercised the
real status method instead of directly changing a row. The migration now adds
that column too, and status mutation can return an inactive profile without
making it authenticatable.

Intermediate corrections retained in local logs: the new User type initially
missed the bootstrap admin's revision; the old inactive-account fixture issued
a link after disabling the user, which is now rejected at issuance; async
WebCrypto proof solving exceeded a five-second case budget. The test now solves
the same real 100,000-bound SHA-256 challenge with Node's synchronous hash loop,
keeping challenge policy and assertion deadlines unchanged. The signing-key
environment import remains before auth modules after route extraction.

At the first composed token snapshot, typecheck/lint passed and the full server
suite passed **150/150**, including10 HTTP/SQLite/WebSocket lifecycle cases,
11 existing magic-link cases and9 startup cases. Subsequent strengthened
wrong-purpose/correct-use assertions and inactive request handling require
fresh focused validation; final exact-head review and CI results belong in the
PR discussion. Local logs under `/tmp/graphdone-resolution-20261027/token-*`
retain the initial failures and corrections; the repository record travels with
the fix rather than treating those local files as published knowledge.

Limits: no live provider/email/Cloud/D1 acceptance or deployment is established.
Existing requests authorized before reset are not rolled back. Idle sockets
are denied at their next operation/result, not claimed to be instantly closed
across API processes. Do not infer verified-provider email or account-linking
safety from token-purpose tests; that remains separate work in #184.

Independent review of `b79ecd593ef92a12e9d4b3070da68e42f9254477` found two
additional live consumers: human JWTs in `agent-api.ts` and `operations-api.ts`
still used signature extraction without checking the account revision. On
2026-10-27, four real-router negative controls all failed with HTTP201 instead
of401: reset and disable/reactivate sessions could mint new scoped credentials
in each API. The agent route used a bounded graph adapter, while both auth and
operations stores used real SQLite. Signature verification is not session
authorization; enumerate every live token consumer when adding revocation.
Both human paths now call the common active-account/revision resolver. Existing
scoped credentials keep their explicit separate contract. The corrected
16-case HTTP/SQLite/WebSocket suite passed; full frozen-head checks and review
follow in the PR. The operations smoke script also now signs explicit revisions.
