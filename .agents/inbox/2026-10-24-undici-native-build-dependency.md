# A native-build dependency can block promotion even without an application import

Date: 2026-10-24. Searched the existing dependency-audit and Zod lessons before
changing the main-promotion candidate `d9278cbd7057b9d0d33f078c860596b4176b9b13`.
A fresh production audit reported Undici 6.28.1 through the optional installed
chain `sqlite3@6.0.1 → node-gyp@12.4.0 → undici@6.28.1`. Source inspection found
no direct application import of the npm Undici package. Optional installation
and build-time reachability do not justify removing it from the audit.

The official advisories identify the affected content-encoding error path in
[GHSA-xjj6-f33q-929c](https://github.com/advisories/GHSA-xjj6-f33q-929c)
and retained EventSource parser state in
[GHSA-4qv8-2p9j-2685](https://github.com/advisories/GHSA-4qv8-2p9j-2685).
Both are fixed on the 6.x line in 6.29.1. The existing node-gyp range
`^6.25.0` accepts that patch. Earlier audit responses differed, but the advisory
publication evidence predates both observed responses; the metadata/cache cause
of that difference is unproven.

## Dated reproduction and correction

Node 22, in the owned `core-undici-fix-20261024` worktree:

```sh
npm ci --legacy-peer-deps --no-audit --no-fund
node --test tests/lib/dependencies/undici.test.mjs
npm audit --omit=dev --audit-level=high --json --cache <new-owned-temporary-directory>
npm update undici --package-lock-only --legacy-peer-deps
npm ci --legacy-peer-deps --no-audit --no-fund
npm run test:unified:lib
npm audit --omit=dev --audit-level=high --json --cache <another-new-owned-temporary-directory>
npm explain undici --json
node_modules/.bin/tsx scripts/test-admin-bootstrap.mts
```

Before the update, the clean install passed, both new regression cases failed,
and the fresh-cache production audit exited 1 with eight moderate and one high
package findings. Afterward, clean installation and all **207 harness cases**
passed with no skips. The fresh-cache production audit exited 0 with **zero
high/critical and eight moderate findings**; Undici was absent from that report.
Both temporary audit caches were removed.

The lockfile changes only the version, registry URL and integrity of its single
`node_modules/undici` entry, from 6.28.1 to 6.29.1. No manifest, override,
dependency classification or other package record changes. The regression
rejects the advisory ranges in every locked copy and checks SQLite's actual
node-gyp resolution against the lockfile and its existing dependency range.
It prevents a nested fixed copy from disguising an affected consumer resolution.

The existing real native-SQLite bootstrap fixture also passed: generated private
credentials, password validation, no development viewer, and stable account
identity across process restarts in its owned temporary directory. Evidence is
retained under `test-artifacts/undici-20261024/`: `regression-before.log`,
`audit-before.json`, `install-before.log`, `install-after.log`,
`harness-after.log`, `audit-after.json`, `resolution-after.json`,
`lock-delta.json` and `sqlite-bootstrap-after.log`.

## Corrective rule and limits

Trace the actual installed consumer before making a narrow compatible lockfile
update. Keep the previous failure, use a fresh audit cache, check every resolved
copy, and validate native consumer compatibility. Do not force an audit fix or
remove optional dependencies merely to make the count green.

These are dependency-version and native-auth-store checks, not an exploit
reproduction, HTTP login, rebuilt-container persistence, hosted deployment or
proof of application non-exploitability. Updating the npm package does not
update Node's separately bundled `fetch` implementation. Full composed CI and
the rebuilt production stack remain separate integration evidence; eight
moderate production findings remain open. No shared database, existing volume,
registry or deployment was touched.
