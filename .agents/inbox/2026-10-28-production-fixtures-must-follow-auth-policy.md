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

## Additional composition corrections

Independent review of8746e7d found three other stale fixture assumptions. The
actual owned pruned API image `sha256:4deb93462ed64371cc64a425f099449ad7561f3e4df2a46f336658b44caa8a00`
failed the old persistence probe's npm Cmd assertion before creating resources.
The updated probe checks the declared direct-Node command/server working directory
and runs Node directly; npm is intentionally absent. Actual fresh-image recovery
still requires validation. `main-refresh-sqlite-image-negative.log` retains this
failure without credentials.

The aggregate workflow correctly required runtime-images, but inherited test
inputs omitted it: the executed workflow suite reported27pass/2fail. Include the
runtime job in successful fixtures and failure/missing-state coverage; do not
remove the actual required gate. `main-refresh-workflow-negative.log` is retained.

The old production CLI's disposable Git fixture also invoked auto-maintenance.
Independent trace evidence confirmed the child invocation, not a new ENOTEMPTY
failure. Apply the [canonical fixture-local maintenance safeguards](2026-10-27-disposable-git-fixtures-must-own-maintenance.md)
before committing, and verify the actual commit trace contains no maintenance
child. Keep strict removal and do not change the user's Git configuration.

The grouped correction passed49/49 executable runner, production-helper and
workflow contracts on2026-10-28, with no skips. Retained output:
`main-refresh-grouped-contracts.log`. Actual container/browser acceptance remains
required; this result does not substitute for either.

## Limits

Synthetic HTTP contracts are not evidence that nginx, the live server ledger or
the browser widget work together. Retain actual production failures and test the
exact reviewed composition before updating acceptance claims. This correction
changes test infrastructure, not CAPTCHA policy, main authority or deployment
permission. No release or deployment is implied by a successful fixture login.
