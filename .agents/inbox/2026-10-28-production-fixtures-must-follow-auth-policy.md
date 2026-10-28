# Production acceptance fixtures must follow the current authentication policy

Observed2026-10-28 UTC while refreshing #191 from reviewed development work. The
existing CAPTCHA and production-login lessons were searched first. The older
production acceptance helpers posted password-only login mutations, while #183
now requires a server-issued, action-bound proof for production login.

## Evidence

```text
2026-10-28
node --test tests/lib/runner/production-stack.test.mjs tests/lib/production/sqlite-recreation.test.mjs
before correction:15 passed,2 failed
production fixture login solves a server-issued proof before seeding:failed
production recreation obtains fresh login proofs before and after restart:failed

node --test tests/lib/runner/production-stack.test.mjs tests/lib/production/*.test.mjs
after correction:19 passed,0 failed,0 skipped
```

Retained logs: `/tmp/graphdone-resolution-20261027/main-refresh-captcha-negative.log`
and `main-refresh-captcha-positive.log`. These are executable helper contracts,
not actual HTTPS-stack acceptance. The refreshed composition still requires the
real browser, generated-account, saved-graph and container-recreation gates.

## Cause and corrective rule

A previously valid fixture can become invalid after an intentional security
boundary changes. Keep the application policy intact. Request the owned API's
login challenge, validate its shape and advertised work bound, solve that exact
challenge, and submit its proof with the generated credentials. Acquire a fresh
proof for each authentication attempt, including after process recreation;
process-local challenge ledgers intentionally do not survive restarts.

The proof helper caps work at100,000, rejects unsupported algorithms, invalid
responses and unsolvable challenges, and never logs credentials or proofs. The
actual request transport remains restricted to the owned loopback HTTPS target.
Production browser sign-in must exercise the visible verification widget, not
manufacture or bypass its state. Preserve the fail-closed release workflows and
both production-stack/runtime-image requirements when composing current dev.

## Limits

Synthetic HTTP contracts are not evidence that nginx, the live server ledger or
the browser widget work together. Retain actual production failures and test the
exact reviewed composition before updating acceptance claims. This correction
changes test infrastructure, not CAPTCHA policy, main authority or deployment
permission. No release or deployment is implied by a successful fixture login.
