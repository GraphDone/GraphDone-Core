# OAuth email linking needs provider proof and an isolated transaction

On 2026-10-27, the #184 OAuth review traced live `oauth-strategies.ts` into
`findOrCreateUserFromOAuth` at token head `5aa307c`. Synthetic owned SQLite
controls established two failures: unverified email linked to the existing
admin fixture, and an intentionally rejected provider insert left one new user
instead of zero. No live provider or shared user database was touched.

## Evidence and correction

`npm test --workspace @graphdone/server -- tests/oauth-identity.test.ts` on the
unchanged implementation produced two failures and one disabled-subject control
pass after correcting the fixture's initially wrong status-method name. The
first run's fixture error is not evidence of an application defect.

The fixed helper requires explicit verified-email/authority evidence for new
links, selects bound provider+subject before email, rejects inactive accounts,
and checks the authenticated revision again. Dedicated file-backed SQLite
transactions make user creation and provider linking atomic. Actual provider
strategy tests exposed important adapter contracts: GitHub's default mapping
drops verification flags; LinkedIn's short callback skips userinfo. The revised
configuration retains GitHub metadata, requests LinkedIn userinfo with the
nine-argument callback, checks its subject and uses its documented issuer.
Google third-party email verification alone is not ownership authority.

The first concurrent transaction implementation used native busy waits on eight
connections; the five-second regression timed out. SQLite waits can occupy the
native worker pool needed by the transaction holding the lock. Serialize this
process's OAuth writes by database file, keep the transaction on its own
connection, hash before acquiring the write lock, and use bounded asynchronous
busy retries. Do not put an async transaction on the shared auth connection:
unrelated writes could join its rollback. The regression now proves eight first
logins create one user/binding, and an unrelated rollback cannot erase that user.
No test timeout increase was used as the correction.

Node 22.18.0 focused validation passed 38 cases across `oauth-identity`,
`oauth-profiles` and `oauth-strategies`, including actual local HTTP callback
issuance and stale-revision rejection. Initial build errors from the GitHub
state declaration, an unused token import and the project's augmented Express
request type were corrected without weakening runtime checks. The callback
uses contextual `RequestHandler` typing. Final full gates are recorded on the PR.

## Limits and recovery

The [provider contract and recovery policy](../../docs/quality/OAUTH_IDENTITY.md)
links official sources and describes existing bindings, absent proof, legacy
credential retention and synthetic-test limits. Existing bindings are preserved,
not retrospectively certified. New provider tokens/raw profiles are not stored;
callback logs no longer expose credential-bearing redirects. Private traces and
raw tokens must stay out of repository notes. No deployed provider acceptance
or hosted account clearance follows from these local tests.
