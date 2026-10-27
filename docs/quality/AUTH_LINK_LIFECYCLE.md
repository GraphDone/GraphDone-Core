# Email link purpose and session lifetime

This contract is implemented by the SQLite authentication path. The token work
for #184 depends on the server CAPTCHA policy in #195; provider email proof and
OAuth account linking remain a separate review.

## Purpose and migration

Every newly issued email link stores `login` or `password-reset`, the account
ID when one exists, and its current `authVersion`. Login redemption only claims
login links. Password reset only accepts a reset link bound to an active account
at the same revision. A wrong-purpose request leaves the link available for its
correct purpose; expiry and one-use checks occur in the SQLite write predicate.

Startup adds the new columns idempotently and marks old untyped links used.
People with old emails must request a new link; migration does not guess a
purpose. Existing users start at revision zero. A correctly signed legacy JWT
without a revision is interpreted as zero, so it continues until its existing
expiry or the account's first revision change. Invalid/negative/non-integer
revision claims are rejected. New JWTs always carry an explicit revision.

## Reset and account status

Reset performs one conditional SQLite user update: password hash and revision
change together, only if the reset token is still unexpired, unused, correctly
purposed and bound to the current account revision. A trigger in that same
statement revokes outstanding links. If revocation fails, the password/revision
update rolls back. Concurrent reset attempts can produce only one success.
Administrative password updates use the same revision/trigger mechanism.

Disabling or reactivating an account changes its revision whenever status
changes. Repeating an unchanged status does not mint a new revision. Reactivation
therefore cannot revive an earlier session or link. The migration also supplies
the existing status API's missing `deactivationDate` column, and status updates
return the inactive account without making it available to authentication.

HTTP GraphQL context, share-link creation and human sessions in the agent and
operations APIs verify the current active account and revision. Existing scoped
`gd_agent_` and `gd_ops_` credentials retain their separate expiry, revocation,
scope and active-owner checks; password reset does not revoke those credentials.
WebSocket connection authentication and every
outgoing result recheck the revision. A rejected socket closes with code4403;
an idle transport can remain open until its next operation/result, without
restoring authorization. Requests already authorized before a concurrent reset
are not retroactively undone. Refresh rejects an authorization snapshot whose
revision no longer matches. Password/OAuth issuers sign the revision of the
identity they authenticated; login-link redemption rejects a revision change
between consumption and identity lookup.

## Evidence and boundaries

`packages/server/tests/auth-link-boundary.test.ts` mounts the production email
handlers with real in-memory SQLite, Apollo HTTP and graphql-ws transports. It
covers cross-purpose rejection and subsequent correct use, reset/disable/
reactivate revocation, an already connected socket, fresh login, concurrent
reset, trigger rollback, old-schema migration, delayed expiry and stale refresh/
identity snapshots. `magic-link.test.ts` retains login concurrency, replay,
expiry and database-error controls. Production startup tests retain environment
loading and signing-secret checks. Owned-fixture CAPTCHA proofs are genuinely
solved and verified; the test uses a bounded Node SHA-256 loop to avoid async
WebCrypto scheduling costs. It does not lower production challenge difficulty.

The same suite mounts the real agent and operations routers and attempts
credential issuance with reset and disabled/reactivated JWTs. The operations
store is real in-memory SQLite; the agent graph driver is a bounded test adapter,
so these cases prove the HTTP authorization boundary, not Neo4j execution. Both
stale-session paths must return401 without issuing a credential or querying graph
content, while a fresh password login must succeed.

These tests do not exercise live email delivery, a provider callback, Cloud D1,
shared databases or a deployment. The old unused Neo4j authentication modules
are not asserted to implement this contract. Provider subject/verified-email
rules and linked-account recovery remain the OAuth portion of #184.
