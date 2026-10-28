# Self-host base maintenance and complete Debian advisory inventory

This #209 candidate starts from integrated dev `780a7599d1d7949d5e0fac56091f0b07bb0e6e0d`.
It updates the self-host API’s three Node stages from Bookworm to a pinned
Node 22/Trixie slim manifest and applies available runtime package upgrades.
The application remains on glibc; UID 1000, its auth-data path, compiled native
SQLite, API/MCP entry points and production secret requirements are preserved.
It publishes or deploys nothing.

## Selection and residual risk

[Node’s image documentation](https://github.com/nodejs/docker-node/blob/main/README.md#supported-architectures)
identifies Alpine/musl support as experimental. The existing Alpine API image
has a smaller scan inventory, but moving self-host to it would add a libc and
platform-support tradeoff. This change instead evaluates the maintained Debian 13
line. A lower scanner count alone does not establish runtime safety.

| Inventory, 2026-10-28 UTC | Bookworm baseline | Trixie candidate |
| --- | ---: | ---: |
| OS packages | 88 | 79 |
| OS package/advisory entries | 228 | 162 |
| Critical / high / medium / low / unknown | 1 / 56 / 87 / 83 / 1 | 0 / 43 / 58 / 60 / 1 |
| Affected / deferred / will-not-fix scanner status | 170 / 41 / 17 | 160 / 2 / 0 |
| Unique source-package/advisory pairs | 99 | 71 |
| npm packages / findings | 377 / 0 | 377 / 0 |

The [complete CSV](SELF_HOST_OS_TRIAGE_2026-10-28.csv) retains **all 228 baseline
and 162 candidate entries**, its installed binary/source version, scanner status,
Debian release status/fixed version/deferral reason and direct vendor advisory
link. All 390 entries resolve in the dated primary tracker snapshot. No rows are
suppressed or converted to a zero-finding claim. Neither scan reports an
available fixed package version for its remaining findings. Trixie’s residual
vendor states are 160 open entries and 2 postponed entries; they remain unresolved.

Compared by source package and advisory, 34 baseline pairs disappear and 6 new
pairs appear. Four new pairs concern the OS `sqlite3` package: CVE-2026-50812,
CVE-2026-50813, CVE-2021-45346 and CVE-2025-70873. Its installed binary is a
`liblastlog2-2` dependency. The tested Node and application SQLite native addon
linkage does not include system `libsqlite3`; that observation does not establish
unreachability through every installed program. The other two concern `gcc-14`:
CVE-2026-102010 and CVE-2026-95619. Node and the native addon do link libstdc++;
these remain explicit applicability risks, without an untested exemption.

The baseline critical entry CVE-2023-45853 needs its specific
[Debian assessment](https://security-tracker.debian.org/tracker/CVE-2023-45853):
Bookworm does not build the affected contrib/minizip component. That assessment
cannot be generalized to other advisories. The candidate no longer reports that
entry. This is a maintenance improvement with residual OS findings, not full
image-security clearance or authorization to release.

## Exact local provenance

- Node base index: `node:22-trixie-slim@sha256:8eb619e402eaede1748a3c8173bffab391592812e85136452f781741c7242ddf`.
  Its linux/amd64 manifest is `sha256:93c4ef18bd9f668c013e8800677f6709fe426db3f29fe758d34dd72600018a7e`.
  The observed runtime is Node 22.23.4 on Debian 13.7.
- Candidate local image reference: `sha256:21058831b3b9af15ac6f8f9f7246b96fd97313a7e19b3d6218214c644b2a37f4`;
  scanned config ID: `sha256:348f5dfe78123f6fc06cb4f1eaabd4e8617eb5f9c29b47e989fffced61c9269a`.
- Baseline local image reference: `sha256:8d464a8965e84b815e0c5172ccac982b9942a50b07a474e5dac83ce72c637ea4`;
  scanned config ID: `sha256:b6f3f2712d57e80d4ab65e8ddbfa50a53278bfb3aa8d960745f021bfc0f448da`.
  This is the retained #211 packaging image (reviewed source `7d327c1`); Core/server/
  MCP source paths are unchanged between that commit and integrated dev 780a759.
  Its complete package/version and advisory inventories also match the final
  dev CI self-host scan, whose separate config ID is
  `sha256:a4890a142c16079a6fce7dae49de8bc9cbee0ade2a8c03644a44c865d5de8074`.
- Scanner: Trivy 0.76.1,
  `aquasec/trivy@sha256:790fd66d1697395d8693d1acaa1ea702406a20f109b6fc7bac8db623eca6c06c`.
  DB updated 2026-10-27T19:17:44.708952708Z, next update 2026-10-28T19:17:44.708952538Z.
- Raw baseline scan SHA256: `8bc29221f686de884e5c5f27a40d844740c3e0781ab8cb199b0ac5ca31a3de5d`.
  Candidate scan SHA256: `cac1783fe2914e5b221b4dff25a36013bff9bd6e7664309f0d48189c151a5720`.
- [Debian primary tracker JSON](https://security-tracker.debian.org/tracker/data/json)
  downloaded 2026-10-28; SHA256
  `0e8487c7976df106b5772472d5b50434ac060e9ce8c5e9fc0d1b74cdd6dab1d5`.

Local raw evidence is retained in `/tmp/graphdone-resolution-20261027` with the
`selfhost-trixie-` prefix, the baseline `runtime-selfhost-tzdata-trivy.json`, and
`debian-security-tracker-20261028.json`. These are preparatory working-tree
results; the containing PR’s exact-head checks and independent review still
govern integration. CI artifacts supply the published final image provenance.
Pinned base refreshes must be reviewed regularly; pinning is not automatic
security maintenance. Apt repositories and scanner data can change, so image,
package and database provenance must accompany later builds too.

## Runtime and rollback evidence

The existing runtime contract now optionally accepts an immutable baseline
image ID. It starts baseline → candidate → replacement candidate → baseline
rollback using one owned auth-data volume, checks the same SQLite account ID,
and exercises real CAPTCHA, API, compiled MCP stdio and independent Neo4j
readback on every stage. It verifies fixture deletion and removes its owned
containers and volume. The default two-stage CI mode remains available.

```sh
GRAPHDONE_DISPOSABLE_NEO4J=1 node tests/runtime/run-image.mjs   <candidate-image> 1000 <immutable-baseline-image-id>
```

Explicit loopback Neo4j fixture credentials are also required. All four local
stages passed; the candidate also passed UID 1000, native SQLite, package inventory
and default-secret rejection. The observed 393 installed-package entries in the
contract are a different counting method from Trivy’s 377 npm packages. No
production graph or auth volume was used. Local and CI evidence is linux/amd64;
this is not an arm64 validation claim. Restoring an old image also restores its
known vulnerabilities, so rollback is an operational escape path, not a security
remediation. No application schema or user-data migration is introduced here.
