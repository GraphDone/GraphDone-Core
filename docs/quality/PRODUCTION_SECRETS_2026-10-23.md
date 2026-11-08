# Production startup must reject default secrets before authentication initializes

Date: 2026-10-23. Baseline: runtime branch `5f0f454`. Scope: GraphDone-Core API
startup and production launch configuration; no deployment was performed.

## Symptom and cause

The API accepted missing signing configuration in production. JWT signing used
the public fallback in `src/utils/auth.ts`; Express sessions used the public
fallback in `src/index.ts`. The registry Compose file also supplied a published
placeholder. The API image lacked `NODE_ENV=production` when launched directly.

Additionally, `index.ts` called `dotenv.config()` after importing modules that
capture `JWT_SECRET`. Supplying the intended key only through `.env` could leave
token signing on the fallback captured earlier. Checking environment values
after those imports would not fix that ordering defect.

Existing guidance was searched in `docs/quality` and `docs/security`; the older
TLS implementation plan listed default JWT secrets but provided no startup
regression. The correction and production setup are now linked from the
[deployment guide](../deployment/README.md#required-production-signing-secrets).

## Corrective rule

Load environment configuration as the API entry point's first dependency, then
validate both signing variables before importing authentication or starting a
database or listener. Production rejects absent, empty, whitespace-only and
known published default/example values. Errors contain variable names only.
Development and test retain existing behavior.

The production API image now declares production mode. All three legacy
production Compose variants explicitly pass both variables without a fallback;
the API rejects empty values. This keeps Compose config validation and
development setup's infrastructure-only start usable. The self-host installer
already generates separate random values and needs no change. The production
CI smoke step generates ephemeral secrets without printing them.

## Dated regression evidence

On 2026-10-23, Node 22.23.4 with a clean `npm ci`:

```text
npm run build --workspace=@graphdone/core
npm test --workspace=@graphdone/server -- tests/production-startup.test.ts

Same final test against unmodified 5f0f454 index.ts:
6 failed, 2 passed
  missing/default production secrets were accepted
  .env key verification failed with "invalid signature"
  NODE_ENV=production from .env did not enforce secret configuration

npm test --workspace=@graphdone/server -- tests/production-startup.test.ts tests/production-secrets.test.ts
29 passed (including the additional published Kubernetes placeholder found in review)

npm test --workspace=@graphdone/server
57 passed across 5 files

npm run build --workspace=@graphdone/server
exit 0
```

The startup tests import the actual API entry point and use real Apollo/Express
startup and JWT signing. SQLite initialization, Neo4j responses, schema creation
and the optional admin subprocess use test doubles. `Server.listen` is observed
without binding a socket. Positive controls reach that boundary with configured
production values, with `.env` values, and in development without secrets. The
negative controls assert that database initialization and listening never run.
Pure validation tests cover both variables and all known repository placeholders.

Six additional built-entry subprocess probes ran in temporary working
directories with no shared data and a nonservice Neo4j address. Missing both,
each individually missing, each built-in fallback, and production mode supplied
by `.env` all exited 1 with `Invalid production secrets`, before startup output
or creation of a data directory. Compose JSON validation of each legacy variant
confirmed generated values are forwarded unchanged and absent values remain
empty. Probe output contained only case names and outcomes.

The final API image also built successfully:

```text
docker build -t graphdone-audit-secrets:20261023 -f packages/server/Dockerfile .
docker run --rm --network none --read-only graphdone-audit-secrets:20261023
exit 1: Invalid production secrets: JWT_SECRET, SESSION_SECRET
```

Six network-disabled, read-only container probes (missing values individually
and together, both built-in fallbacks, and the Kubernetes placeholder) rejected
configuration before startup without an explicit `NODE_ENV` override. A seventh
container loaded the actual environment bootstrap with generated secrets and
verified a JWT against the configured key. That positive container probe did
not start the full API; the actual-entry tests above establish its listen
boundary without shared sockets or databases.

## Compatibility and limits

Existing production installations using missing/default values must configure
both variables before upgrading. Keep them stable across restarts; changing
JWT/session signing keys invalidates existing tokens/signed sessions. Generate
independent cryptographically random secrets; rejection of known placeholders
is not an entropy test for arbitrary values.

These checks establish the startup configuration boundary, not a complete
production deployment or database/browser health check. Existing Express
MemoryStore warnings remain visible in the positive tests; session storage,
OAuth, CAPTCHA and key rotation mechanisms are outside this change. No hosted
configuration or secret was read or changed.
