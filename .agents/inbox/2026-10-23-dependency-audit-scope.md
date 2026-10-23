# Audit counts need source reachability and bounded regression evidence

On 2026-10-23, the unchanged runtime lock at `6b2a007` produced 23 full-audit package entries and eight production-only entries. An isolated lint-tool correction reduced the full count to 17, while production remained eight. The canonical [security scope](../../docs/quality/SECURITY_SCOPE_2026-10-23.md) records families, priorities, authentication probes, and limits.

Evidence: `npm audit --package-lock-only --json`, `npm audit --omit=dev --json`, a clean lockfile install, `npm run lint`, `npm run test:unified:lib` (106 passed), and `npm run test` (434 passed, 25 database-gated skips). The minimatch regression fails against 9.0.3 at its bounded two-second child deadline and passes against the scoped 9.0.7 override. A separate real in-memory SQLite probe returned two successful verifications of one magic-link token; a synthetic CAPTCHA code was also accepted. No deployed credentials or shared database were inspected.

Cause: advisory severity and dependency classification do not describe the actual call site. Conversely, a browser-only lockout and a green production dependency gate do not establish backend abuse controls. Historical documentation had described UI attempt tracking as completed brute-force protection.

Corrective rule: record the exact source/lock snapshot, distinguish package entries from distinct vulnerabilities, trace runtime inputs and deployment packaging, reproduce suspected application gaps in owned fixtures, and keep version updates narrow enough to validate. Preserve negative controls in the existing harness; do not suppress findings by relabeling dependency categories.

Limits: reachability conclusions are bounded source observations, not proof of non-exploitability. Authentication follow-ups remain open. The security-scope document is the reviewable record; local log paths alone are not published validation.
