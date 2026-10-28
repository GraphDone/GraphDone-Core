# Reconcile updated advisory ranges with the already locked consumer

The October 23 inventory and #186 recorded three moderate CSS-chain entries.
On 2026-10-27, fresh-cache `npm audit --omit=dev --json` on dev
`8712389e24f567f5b3e6ed132c1ac5d4dafb21fa` reported five moderate entries:
Router/DOM and UUID/federation/subgraph, with no CSS-chain entry.

The [official selector-parser advisory](https://github.com/advisories/GHSA-rj75-hqrm-r3gf)
was read directly and via `gh api /advisories/GHSA-rj75-hqrm-r3gf`.
Its `updated_at` is `2026-10-26T14:07:57Z`, `withdrawn_at` is null, and its
affected ranges are `<6.1.5` and `>=7.0.0 <7.1.6`, with fixes 6.1.5 and 7.1.6.
`npm ls postcss-selector-parser postcss-nested tailwindcss --all` resolves
Tailwind 3.4.19 and postcss-nested 6.2.0 to parser 6.1.5. This was already locked
in commit `36c02c020832cafd8f67b9fae85d126827e89a98`, dated 2026-10-23:
`git show 36c02c0:package-lock.json` contains the same parser version.

The historical audit remains evidence of what that run reported. The current
official fixed ranges and actual consumer now establish that this locked CSS
path is patched. There is no dependency update or reclassification in this
follow-up. Do not force a Tailwind major migration or attribute the older audit
to an unproved cache/publication cause merely to make the historical count agree.

The dedicated regression checks both maintained fixed branches and every locked
parser path, then resolves the actual Tailwind and postcss-nested consumers.
It verifies flat-selector round trips, nested selector output, and generated
base/responsive Tailwind utilities. The flat input is bounded at 2048 classes;
this is semantic coverage, not a claimed CPU-exhaustion benchmark. Fresh build,
integrated browser checks and exact-head results belong in the PR discussion.

Limits: trusted build-time CSS was the inspected application surface. This is
clearance of the named advisory for the current resolution, not full CSS/npm/OS
security or deployed-site acceptance. Router, UUID and dev-tool work have their
own PRs. Preserve fresh dated audit payloads as metadata can change independently
of the lockfile. Local evidence: `/tmp/graphdone-resolution-20261027/css-*`.
