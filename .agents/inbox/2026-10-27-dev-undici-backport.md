# A reviewed main-promotion patch does not repair an older dev dependency tree

Date: 2026-10-27. Searched the symptom and security-audit indexes. PR #192's
production audit failed on Undici 6.28.1 although pending main PR #191 already
contained the reviewed 6.29.1 patch. Live dev was
`ef495eff15ed7aac51e72dc7a1db1bb96d2b3695`; it did not contain that patch.

## Evidence and correction

```sh
gh run view 40541503856 --repo GraphDone/GraphDone-Core --job 122321255119 --log-failed
git show --stat 8a9c7512b5dedf4020d117887674d378de85667b
git cherry-pick 8a9c7512b5dedf4020d117887674d378de85667b
```

Backport head `765cf1985c389f8850a13df338d56c8113350ce7` changes only the single
Undici lock record, its two consumer-resolution regressions and indexed guidance.
The index conflict was resolved by adding the Undici row while preserving dev's
entries; unrelated main-only lesson links were not imported. Historical October
24 evidence remains dated and is not presented as a new run.

Fresh Node 22.18.0 / npm 10.8.2 validation on the backport:

- `npm ci --legacy-peer-deps --no-audit --no-fund`: passed, 1,221 packages.
- `npm run test:unified:lib`: 163/163 passed, zero skips.
- `node_modules/.bin/tsx scripts/test-admin-bootstrap.mts`: real native SQLite
  password/recovery-file/no-demo-user/stable-restart fixture passed and cleaned.
- `npm run typecheck`, `npm run lint`, `npm run build`: respectively five, four
  and four tasks passed. Existing lint warnings remain.
- Fresh-cache `npm audit --omit=dev --audit-level=high --json`: exited zero,
  zero high/critical and five moderate findings. Undici was absent; remaining
  families were router and UUID/Apollo federation. Counts are dated package
  findings, not exploit counts.
- `npm explain undici --json`: the SQLite/node-gyp consumer resolves 6.29.1.
- Independent exact-head agent review: no findings; not a GitHub non-author
  approval. PR #194 carries remote checks; pending checks are not passes.

Sanitized local evidence is in `/tmp/graphdone-resolution-20261027/undici-*`.
Remote CI: [40565630797](https://github.com/GraphDone/GraphDone-Core/actions/runs/40565630797);
Node 22/24 and installer suite:
[40565630734](https://github.com/GraphDone/GraphDone-Core/actions/runs/40565630734).

## Corrective rule and limits

Check live branch ancestry before duplicating an existing fix. Backport the
smallest reviewed compatible change, resolve only the actual conflict, and
refresh consumer/runtime/audit evidence on the target composition. Do not merge
unrelated main-promotion work just to obtain a dependency patch.

This does not close #185/#186, prove application exploitability, update Node's
bundled fetch, publish a release or establish hosted parity. Final branch CI and
integration verification remain required by the dev admin playbook.
