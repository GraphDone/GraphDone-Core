# Archived test files — 2026-06 test-tree cleanup

**Status: flagged for deletion.** These were identified as dead / stale / duplicate
/ placeholder during the clean-tree test refactor (see `docs/test-tree-refactor-plan.json`).
They are **archived, not deleted**, so we can mine them for any salvageable code,
selectors, or test data before removing them for good. Original repo-relative paths
are preserved under this folder. Nothing here is run by Playwright, vitest, CI, or
any npm script (references were repointed when these moved).

When you're satisfied nothing of value remains, delete `archive/2026-06-test-cleanup/`.

## E2E specs (redundant / stale / placeholder)
| file | why archived |
| --- | --- |
| tests/e2e/auth-basic-test.spec.ts | redundant admin-login; covered by form-validation/mobile-audit |
| tests/e2e/auth-system-test.spec.ts | vague auth validation; form-validation is more specific |
| tests/e2e/add-node.spec.ts | overlaps the user-smoke grow flow |
| tests/e2e/comprehensive-interaction.spec.ts | vague exploratory; overlaps diagnostics core-matrix |
| tests/e2e/comprehensive-graph-operations.spec.ts | vague; overlaps living-graph + real-time |
| tests/e2e/database-connectivity.spec.ts | Neo4j-only failure path obsolete under D1-first arch |
| tests/e2e/fix-left-click-refresh.spec.ts | one-off bug proof, untagged, unreferenced |
| tests/e2e/flash-detection.spec.ts | exploratory, untagged; overlaps showcase |
| tests/e2e/graph-error-handling.spec.ts | data template, not a real test; schema-mismatched |
| tests/e2e/graph-real-time-updates.spec.ts | unclear purpose; overlaps living-graph |
| tests/e2e/manual-test.spec.ts | manual placeholder, no assertions |
| tests/e2e/neo4j-core-functionality.spec.ts | redundant with @core; untagged |
| tests/e2e/neo4j-working-demo.spec.ts | old demo proof; overlaps user-smoke |
| tests/e2e/oauth-linkedin.spec.ts | stale OAuth provider (magic-link now); mock/fixtures retained for admin spec |
| tests/e2e/project-name-verification.spec.ts | exploratory naming check, untagged |
| tests/e2e/screenshot-current-graph.spec.ts | documentation artifact; overlaps showcase |
| tests/e2e/simple-error-test.spec.ts | template placeholder, no real assertions |
| tests/e2e/ui-basic-functionality.spec.ts | vague; overlaps responsive |
| tests/e2e/user-workflow.spec.ts | overlaps user-smoke/basic-workflow, untagged |
| tests/e2e/user-workflow-robust.spec.ts | overlaps user-smoke, untagged |
| tests/e2e/verify-improved-visualization.spec.ts | old proof; overlaps user-smoke/showcase |
| tests/e2e/verify-ui-data.spec.ts | generic proof, no real assertions |
| tests/e2e/workspace-scrolling.spec.ts | old issue proof, no real assertions |

## Loose runners / debug scripts / configs (superseded)
| file | why archived |
| --- | --- |
| tests/run-all-tests.js | replaced by tests/run-unified.mjs (npm run test:comprehensive → unified) |
| tests/run-pr-tests.js | replaced by tests/run-unified.mjs --profile pr |
| tests/ci-basic-tests.js | mock-only fake results; CI runs real Playwright now |
| tests/quick-auth-test.js | manual debug tool, hardcoded creds |
| tests/simple-login-test.js | manual debug tool, infinite wait |
| tests/manual-graph-operations-test.js | manual debug tool |
| tests/realtime-update-test.js | manual debug tool |
| tests/test-production-scrolling.js | manual debug tool, hardcoded :3128 |
| tests/test-refresh-bugs.js | manual debug tool |
| tests/https-browser-compatibility-test.js | overlaps ported TLS specs; unreferenced |
| tests/global-setup-production.js | dead binding (only the production config referenced it) |
| tests/playwright.config.ts | duplicate config, referenced by nothing |
| tests/playwright.config.production.ts | settings to be folded into root config |

## Redundant shell scripts
| file | why archived |
| --- | --- |
| scripts/generate-final-report.sh | duplicate installation-report generator (keep generate-clean-report.sh) |
| scripts/generate-comprehensive-report.sh | duplicate installation-report generator |
| scripts/test-cert-security.sh | stale, not in CI; covered by test-tls.sh |
| scripts/test-installation-demo.sh | duplicate of test-installation-simple.sh |
| scripts/test-installation-full.sh | duplicate of test-installation-simple.sh |
| scripts/test-installation-functional.sh | duplicate of test-installation-simple.sh |
| scripts/test-installation-macos.sh | single-platform, not in CI |
| scripts/test-installation-multi-distro.sh | deprecated; Docker approach in test-installation-simple.sh |
