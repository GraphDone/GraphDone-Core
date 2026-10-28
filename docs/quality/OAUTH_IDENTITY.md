# OAuth identity and account linking

This is the Core OAuth portion of #184. The separate
[email-link lifecycle](AUTH_LINK_LIFECYCLE.md) defines token purpose and session
revision. These are local implementation contracts, not deployed-provider
acceptance.

## Provider proof

| Provider | Stable identity | Proof required for a new account or automatic email link |
| --- | --- | --- |
| Google | Authenticated userinfo `sub`, matching Passport's parsed ID | Exact boolean `email_verified`, plus Gmail address or a nonempty hosted-domain claim |
| GitHub | Authenticated profile ID | Exactly one primary email with boolean `verified: true` from authenticated `/user/emails` metadata |
| LinkedIn | ID-token subject matching authenticated userinfo subject, under issuer `https://www.linkedin.com` | Userinfo email and exact boolean `email_verified: true` |

[Google's guidance](https://developers.google.com/identity/gsi/web/guides/verify-google-id-token)
distinguishes Gmail/Workspace authority from third-party addresses whose
ownership may have changed since verification. Core applies the conservative
authority requirement to both account creation and automatic linking. It uses
the existing server-side authorization-code strategy and authenticated
userinfo, not a client-submitted ID token.

[GitHub documents](https://docs.github.com/en/rest/users/emails#list-email-addresses-for-the-authenticated-user)
the authenticated email endpoint and required `user:email` scope. Core fetches
that metadata directly and retains verification/primary flags. Missing,
unverified or ambiguous primary candidates cannot establish a new link. There
is no fallback to the public profile email. The bounded request uses
`per_page=100`; pagination beyond that response is not added. Absent proof fails
closed rather than guessing ownership.

[LinkedIn documents](https://learn.microsoft.com/en-us/linkedin/consumer/integrations/self-serve/sign-in-with-linkedin-v2)
the issuer, userinfo endpoint and optional boolean verification field. The
nine-argument OIDC callback exposes the authenticated ID-token profile. Core
fetches userinfo safely and compares both subjects before using its email claim.
The library's own userinfo loader is explicitly disabled: its malformed-JSON
handler references an undefined callback. This authenticates a provider account,
not a person's legal identity.

GitHub and LinkedIn profile requests use fixed HTTPS endpoints, reject redirects,
require successful JSON responses, enforce a five-second deadline and cap each
body at 64 KiB. Errors fail authentication without returning provider response
bodies or tokens. Google retains its existing parsed authenticated userinfo path.

All configured providers use session-bound state. Google/GitHub enable the
existing Passport state store; LinkedIn retains its default session store.
Only configured providers are constructed; a configured ID without a secret
fails startup. The GitHub type package incorrectly narrows the runtime state
option to string; the localized cast preserves boolean `true`. Actual strategy
tests verify state rejection before token exchange and single-use consumption.

## Linking and recovery

An existing provider-and-subject binding is authoritative for account selection.
Changing or omitting its email cannot switch the user to another account.
Disabled bound accounts fail before email fallback. New bindings require the
proof above and match only account email, never username. Disabled, unverified or ambiguous
case-folded email matches fail. Verified provider proof cannot attach the mailbox
owner to a preregistered local account whose earlier password/session remains
controlled by someone else. Both helper return and HTTP callback recheck the
active account and the authenticated session revision; they cannot upgrade an
old snapshot after reset or reactivation.

Existing accounts and provider bindings are retained without a schema migration.
This does not retrospectively prove how an old link was established. An existing
bound subject can continue signing in when its email is absent or unverified.
For a new unproved binding, existing password or email sign-in/recovery methods
remain available; no implicit merge or account transfer occurs. Ordinary local
accounts currently have no implemented verification/linking flow that upgrades
them for automatic OAuth linking. Unverified local accounts therefore cannot add
a new OAuth binding in this change. A future explicit recovery/linking flow must
establish ownership and handle prior credentials/sessions; merely setting a
verification flag is not a recovery procedure. Administrator review of
a disputed historical binding remains a separate action. Old stored provider
credentials are not deleted by this change; new callbacks neither persist
access/refresh tokens or raw profiles nor log token-bearing redirects.

New users and provider bindings commit together on a dedicated connection to
the persistent SQLite authentication file. A link failure rolls back the user.
The transaction cannot join a caller's unrelated transaction. In-process writes
are serialized per file; bounded asynchronous SQLite busy retries avoid parking
the native worker pool. The database transaction/uniqueness constraint also
protects competing processes. Password hashing happens before acquiring the
write lock. In-memory injected databases are not an OAuth production target.

## Evidence and limits

`oauth-profiles.test.ts` covers exact boolean claims, authority, missing and
multiple email candidates, issuer and subject mismatch. `oauth-strategies.test.ts`
drives the actual Passport authorization/callback paths with synthetic token
exchange and profile responses. `oauth-identity.test.ts` uses owned temporary
SQLite files, actual strategy callbacks and a local HTTP completion route. It
covers collisions, subject continuity, disabled/reactivated accounts, concurrent
creation, link rollback, unrelated transaction rollback, revision races, token
issuance and absence of credential logging.

Synthetic provider fixtures do not test live credentials, provider availability,
consent, TLS, signature-key rotation or hosted D1. Tokens in the browser callback
URL retain the existing application contract; removing server logging and adding
no-store/no-referrer does not claim elimination of all browser-history exposure.
Final exact-head review, CI and production browser results belong in the PR.
