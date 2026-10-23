# A single-use email token must be consumed before returning identity

On 2026-10-23, the shared SQLite magic-link verifier accepted one token more than once under concurrent requests. Its initial unused-token lookup was followed by an unguarded, unawaited update. Multiple requests could all finish the lookup before any update completed. The verifier also returned identity for an inactive account.

## Correction

The verifier now awaits an update guarded by token identity, unused state, and a fresh expiry check. Only an update affecting exactly one row may continue to account lookup or creation. Other contenders return `{ valid: false }`. An inactive account also returns false, and its token remains consumed. Existing successful callers still receive `{ valid: true, email, userId }`; a fresh link still creates a new account, and existing accounts can redeem independent valid links.

A database error during consumption rejects before returning identity. If the update failed, the unused token can be retried after the database problem is repaired. If consumption succeeded but the later account lookup fails, the token remains used; the user must request a fresh link. This is intentional failure behavior, not a transaction spanning account creation and token consumption.

## Evidence

Base: `5f0f454`. Tests use the actual SQLite store with fresh in-memory databases; no shared database, runtime port, email delivery service, or deployed credential is involved.

Before correction:

```sh
npm run test --workspace @graphdone/server -- tests/magic-link.test.ts -t 'existing account|inactive account'
```

The selected controls produced **2 failures, 1 pass**, with seven unrelated cases filtered out. Twelve concurrent redemptions of one existing account's token returned multiple successful identities. The inactive-account case returned a successful identity as well.

After correction, `npm run test --workspace @graphdone/server` passed **38/38**, including all **10 magic-link cases**. Coverage includes concurrent existing/new accounts, distinct valid tokens, expired/used/missing tokens, inactive accounts and reactivation, missing-table lookup errors, a real SQLite trigger that rejects the consumption update, and an account-lookup failure after consumption. The existing server suite passes too. Server typecheck/build and whitespace checks pass; ESLint reports zero errors with existing legacy warnings.

Local evidence: `/tmp/graphdone-magic-link-red.log`, `/tmp/graphdone-magic-link-green.log`, `/tmp/graphdone-magic-link-typecheck.log`, and `/tmp/graphdone-magic-link-server-build.log`. Public PR checks and independent review provide subsequent commit-specific evidence.

## Remaining scope

Login and password reset still share the same token purpose; purpose separation needs its own change and cross-purpose tests. This patch does not establish OAuth linking, CAPTCHA verification, password-login throttling, signing-secret configuration, general session revocation, or live email/HTTP behavior. Browser and integrated service gates remain separate from these store-level concurrency tests.
