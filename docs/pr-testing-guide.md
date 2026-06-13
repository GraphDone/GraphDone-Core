# PR Testing Guide

## Overview

GraphDone has a comprehensive test suite designed to validate critical functionality before merging pull requests. This guide explains the PR testing process, available test commands, and how to interpret results.

---

## Quick Start

### Run PR Tests Locally

```bash
# Ensure services are running first
./start deploy

# Run critical PR tests (6 test suites, ~2-3 minutes)
npm run test:pr

# View HTML report
npm run test:report
open test-results/reports/pr-report.html
```

### Run All Tests (Comprehensive)

```bash
# Run comprehensive test suite (11 test suites, ~5-7 minutes)
npm run test:comprehensive

# View HTML report
open test-results/reports/index.html
```

---

## Test Suites Overview

### PR Critical Tests (`npm run test:pr`)

These tests MUST pass before merging any pull request. They validate essential functionality:

| Priority | Test Suite | Description | Typical Duration |
|----------|------------|-------------|------------------|
| 0 | **Installation Script Validation** | Validates `./start` script error handling and Docker operations | ~30s |
| 1 | **TLS/SSL Integration** | Verifies HTTPS certificates, secure connections, protocol handling | ~45s |
| 2 | **Authentication System** | Tests login, logout, session management, security | ~60s |
| 3 | **OAuth LinkedIn Integration** | Validates LinkedIn OIDC flow, profile extraction, token handling | ~40s |
| 4 | **Docker Error Handling** | Tests graceful error detection and user-friendly messaging | ~20s |
| 5 | **Database Connectivity** | Verifies Neo4j connection, query execution, data persistence | ~30s |

**Total Tests**: ~15-20 critical validations
**Expected Duration**: 2-3 minutes
**Failure Tolerance**: 0 (all tests must pass)

### Comprehensive Tests (`npm run test:comprehensive`)

Includes all PR critical tests PLUS additional validation:

- **UI Basic Functionality** - Button clicks, form inputs, navigation
- **Workspace Scrolling** - Viewport behavior, scrolling interactions
- **Graph Operations** - Node creation, edge manipulation, graph algorithms
- **Real-time Updates** - WebSocket subscriptions, live data sync
- **Comprehensive Interactions** - Complex user workflows, multi-step operations

**Total Tests**: ~40-50 validations
**Expected Duration**: 5-7 minutes
**Use Case**: Pre-release validation, major feature testing

---

## Test Reports

### HTML Reports

Beautiful, interactive reports with:
- ✅ **Summary Cards** - Pass/fail counts, duration, environment info
- 📊 **Expandable Sections** - Click suite headers to view details
- ❌ **Error Details** - Full stack traces for failed tests
- 🌐 **Browser Compatibility Matrix** - Cross-browser validation status
- 🎨 **GraphDone Branding** - Professional visual design

**Report Locations**:
- PR tests: `test-results/reports/pr-report.html`
- Comprehensive tests: `test-results/reports/index.html`

### JSON Reports

Machine-readable output for CI/CD integration:
- PR tests: `test-results/reports/pr-results.json`
- Comprehensive tests: `test-results/reports/results.json`

**JSON Structure**:
```json
{
  "timestamp": "2025-11-12T19:30:00.000Z",
  "environment": "production",
  "baseUrl": "https://localhost:3128",
  "totalTests": 18,
  "passed": 15,
  "failed": 3,
  "skipped": 0,
  "duration": 145000,
  "suites": [...]
}
```

---

## CI/CD Integration

### GitHub Actions Workflow

PR tests run automatically on every pull request:

**Workflow Steps**:
1. Checkout code
2. Install dependencies
3. Install Playwright browsers
4. Generate development certificates
5. Start GraphDone services (Docker)
6. Run `npm run test:pr`
7. Upload test results as artifacts
8. Upload HTML report

**Viewing CI Test Results**:
1. Go to PR → "Checks" tab
2. Find "PR Critical Tests" job
3. Click "Details" to view logs
4. Download artifacts to view HTML report

**CI Failure Handling**:
- PR cannot be merged if PR validation fails
- All other jobs (lint, typecheck, security) must also pass
- Review test logs and fix issues before re-requesting review

---

## Writing New Tests

### Adding Tests to PR Suite

Critical tests should be added to `tests/run-pr-tests.js`:

```javascript
const PR_TEST_SUITES = [
  {
    name: 'My New Critical Test',
    command: 'npx playwright test tests/e2e/my-test.spec.ts',
    priority: 6,  // Add after existing tests
    critical: true
  }
];
```

### Test Structure

Follow the existing pattern in `tests/e2e/`:

```typescript
import { test, expect } from '@playwright/test';
import { login, navigateToWorkspace, TEST_USERS } from '../helpers/auth';

test.describe('My Feature', () => {
  test('should do something critical', async ({ page }) => {
    // Use auth helper for consistent login
    await login(page, TEST_USERS.ADMIN);
    await navigateToWorkspace(page);

    // Your test logic here
    const element = page.locator('[data-testid="my-element"]');
    await expect(element).toBeVisible();
  });
});
```

### Shell Script Tests

For testing bash scripts and Docker operations:

```bash
#!/bin/bash
# tests/my-shell-test.sh

TOTAL=0
PASSED=0
FAILED=0

test_something() {
    TOTAL=$((TOTAL + 1))
    if ./start some-command 2>&1 | grep -q "expected output"; then
        PASSED=$((PASSED + 1))
        echo "✅ Test passed: something works"
    else
        FAILED=$((FAILED + 1))
        echo "❌ Test failed: something broken"
    fi
}

test_something
echo "Total: $TOTAL, Passed: $PASSED, Failed: $FAILED"
exit $FAILED
```

Add to test runner:

```javascript
{
  name: 'My Shell Test',
  command: './tests/my-shell-test.sh',
  priority: 7,
  critical: true,
  type: 'shell',
  parser: 'installation'
}
```

---

## Troubleshooting

### "Server not accessible" Error

```bash
# Ensure services are running
./start deploy

# Wait for health check
curl -k https://localhost:4128/health

# If not healthy, check logs
docker compose logs graphdone-api
```

### "Playwright not found" Error

```bash
# Install Playwright
npm install -D @playwright/test
npx playwright install
```

### Certificate Errors

```bash
# Regenerate development certificates
./scripts/generate-dev-certs.sh

# Verify certificates exist
ls -la deployment/certs/
```

### Tests Timeout

```bash
# Increase timeout in test config
# Edit tests/run-pr-tests.js or tests/run-all-tests.js
const TEST_CONFIG = {
  timeout: 120000,  // 2 minutes per test
  ...
};
```

### Database Connection Failures

```bash
# Ensure Neo4j is running
docker ps | grep neo4j

# Check Neo4j logs
docker logs graphdone-neo4j

# Restart Neo4j if needed
./start stop
./start deploy
```

---

## Test Maintenance

### Monthly Review Checklist

- [ ] Run `npm run test:comprehensive` and ensure all tests pass
- [ ] Review and update OAuth tests against latest provider documentation
- [ ] Check for outdated dependencies in test frameworks
- [ ] Verify test coverage for new features added in past month
- [ ] Update test documentation if new patterns introduced
- [ ] Review CI workflow performance and optimize if needed

### OAuth Test Maintenance

See [docs/oauth-testing-guide.md](./oauth-testing-guide.md) for OAuth-specific maintenance:
- Monthly spec review (every 12th)
- Provider documentation updates
- Token handling validation
- Profile schema changes

### Test Performance Optimization

**If tests are running too slowly**:

1. **Parallelize independent tests** - Use Playwright's built-in parallelization
2. **Mock external services** - Use mock OAuth server for faster tests
3. **Reduce wait times** - Optimize timeouts and polling intervals
4. **Cache builds** - Reuse Docker images when possible

**Benchmarks**:
- PR critical tests: Target < 3 minutes
- Comprehensive tests: Target < 7 minutes
- Individual test suites: Target < 60 seconds

---

## Best Practices

### Before Submitting a PR

1. ✅ **Run PR tests locally** - `npm run test:pr`
2. ✅ **Fix all failures** - Do not submit PR with failing tests
3. ✅ **Review test report** - Check for warnings or skipped tests
4. ✅ **Test on clean environment** - `./start stop && ./start deploy`
5. ✅ **Verify HTTPS mode** - Ensure TLS/SSL tests pass

### When PR Tests Fail in CI

1. **Download test artifacts** - Get HTML report from GitHub Actions
2. **Review error details** - Expand failed test suites in report
3. **Reproduce locally** - Run same test suite with `npm run test:pr`
4. **Check for environment differences** - CI uses different certificates, ports
5. **Fix and re-test** - Push fix and wait for CI to re-run

### Writing Reliable Tests

- ✅ **Use auth helpers** - Leverage `tests/helpers/auth.ts` for consistent login
- ✅ **Wait for elements** - Use `await expect().toBeVisible()` not `page.waitForTimeout()`
- ✅ **Test data isolation** - Create unique test data, don't rely on shared state
- ✅ **Handle flakiness** - Add retries for network-dependent tests
- ✅ **Clear error messages** - Use descriptive test names and assertions

---

## Test Commands Reference

```bash
# PR validation (critical tests only)
npm run test:pr

# Comprehensive validation (all tests)
npm run test:comprehensive

# Individual test suites
npm run test:e2e                    # All E2E tests
npm run test:e2e:ui                 # UI mode (interactive)
npm run test:e2e:debug              # Debug mode
npm run test:installation           # Installation script tests
npm run test:https                  # TLS/SSL tests

# Unit tests
npm run test:unit                   # All unit tests
npm run test:coverage               # With coverage report

# Test reports
npm run test:report                 # Open HTML report
open test-results/reports/index.html
open test-results/reports/pr-report.html
```

---

## Support

**Documentation**:
- [OAuth Testing Guide](./oauth-testing-guide.md) - OAuth-specific testing
- [OAuth Implementation Guide](./oauth-implementation.md) - OAuth compliance tracking
- [TLS/SSL Setup](./tls-ssl-setup.md) - HTTPS configuration

**Test Code**:
- Test runner: `tests/run-pr-tests.js` (PR), `tests/run-all-tests.js` (comprehensive)
- Auth helpers: `tests/helpers/auth.ts`
- OAuth mock server: `tests/helpers/mock-oauth-server.ts`
- Test fixtures: `tests/fixtures/oauth-profiles.ts`
- E2E tests: `tests/e2e/*.spec.ts`

**CI/CD**:
- Workflow: `.github/workflows/ci.yml`
- PR validation job: `pr-validation`

---

**Document Version:** 1.0.0
**Last Updated:** 2025-11-12
**Maintained By:** GraphDone Team
**Review Frequency:** Monthly
