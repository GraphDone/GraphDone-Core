# GraphDone-DevOps Integration Guide

## Overview

This document describes the test data pipeline from GraphDone-Core to GraphDone-DevOps for monitoring, analysis, and alerting.

## Data Collection Architecture

### Test Execution Flow

```
GraphDone-Core (test execution)
    ↓
test-reports/artifacts-{timestamp}/
    ↓
test-manifest.json (structured metadata)
    ↓
GraphDone-DevOps (consumption & analysis)
```

## Data Outputs

### 1. Test Manifest (`test-manifest.json`)

**Location**: `test-reports/artifacts-{timestamp}/test-manifest.json`

**Purpose**: Single source of truth for all test run metadata

**Structure**:
```json
{
  "version": "1.0.0",
  "generated": "2025-11-13T22:00:00Z",
  "timestamp": "20251113_220000",
  "git": {
    "branch": "vm_multi-pass",
    "commit": "0bf9cb6...",
    "commitShort": "0bf9cb6",
    "author": "Developer Name",
    "message": "Add test monitoring tools"
  },
  "summary": {
    "e2e": {
      "passed": 3,
      "failed": 0,
      "duration": "1.1s",
      "status": "passed"
    },
    "unit": {
      "passed": 5106,
      "failed": 2,
      "duration": "45.2s",
      "status": "failed"
    }
  },
  "artifacts": {
    "visualRegression": {
      "enabled": true,
      "screenshots": 252,
      "devices": 21,
      "path": "visual-regression"
    },
    "playwrightReport": {
      "enabled": true,
      "path": "playwright-report"
    },
    "coverage": {
      "enabled": true,
      "path": "coverage"
    }
  },
  "logs": {
    "main": "../e2e-report-20251113_220000.md",
    "build": "../build.log",
    "unitTests": "../unit-tests.log",
    "e2eTests": "../e2e-tests.log"
  }
}
```

### 2. Visual Regression Index (`visual-regression/index.json`)

**Purpose**: Catalog of all captured screenshots for diff analysis

**Structure**:
```json
{
  "generated": "2025-11-13T22:00:00Z",
  "totalScreenshots": 252,
  "devices": [
    {
      "name": "iPhone-14-Pro-Max",
      "screenshots": 12,
      "path": "iPhone-14-Pro-Max",
      "files": [
        {"name": "landing-page.png", "size": 125432},
        {"name": "login.png", "size": 98234}
      ]
    }
  ]
}
```

### 3. Visual Regression Screenshots

**Location**: `test-reports/artifacts-{timestamp}/visual-regression/{device}/`

**Format**: PNG images organized by device

**Devices**: 21 configurations (see VISUAL_REGRESSION_README.md)

**Naming Convention**: `{screen-name}.png`

### 4. Playwright Reports

**Location**: `test-reports/artifacts-{timestamp}/playwright-report/`

**Format**: HTML + JSON data

**Contains**: Test execution traces, screenshots on failure, timing data

### 5. Coverage Reports

**Location**: `test-reports/artifacts-{timestamp}/coverage/`

**Format**: HTML reports + `coverage.json`

**Tools**: Istanbul/c8 coverage data

### 6. Log Files

**Location**: `test-reports/`

**Files**:
- `e2e-report-{timestamp}.md` - Main markdown report
- `build.log` - Build output
- `unit-tests.log` - Vitest output
- `e2e-tests.log` - Playwright output
- `visual-regression.log` - Screenshot suite output
- `lint.log` - ESLint output
- `typecheck.log` - TypeScript output

## GraphDone-DevOps Integration Points

### 1. Automated Data Ingestion

**Recommended Approach**: GitHub Actions workflow or local cron job

```bash
#!/bin/bash
# Example ingestion script for GraphDone-DevOps

CORE_REPO=~/GraphDone-Core
DEVOPS_REPO=~/GraphDone-DevOps
LATEST_ARTIFACTS=$(find $CORE_REPO/test-reports -name "artifacts-*" -type d | sort -r | head -1)

if [ -d "$LATEST_ARTIFACTS" ]; then
    TIMESTAMP=$(basename "$LATEST_ARTIFACTS" | sed 's/artifacts-//')

    # Copy artifacts to DevOps repo
    mkdir -p "$DEVOPS_REPO/test-data/$TIMESTAMP"
    cp -r "$LATEST_ARTIFACTS"/* "$DEVOPS_REPO/test-data/$TIMESTAMP/"

    # Trigger DevOps analysis
    cd "$DEVOPS_REPO"
    ./analyze-test-run.sh "$TIMESTAMP"
fi
```

### 2. Visual Regression Baseline Management

**Baseline Storage**: GraphDone-DevOps should maintain baseline screenshots

**Comparison Workflow**:
1. Load `visual-regression/index.json` from new test run
2. Compare against baseline from previous "approved" run
3. Generate diff images using Pixelmatch or similar
4. Flag changes exceeding threshold for review

**Tools**:
- Pixelmatch (https://github.com/mapbox/pixelmatch)
- Resemble.js (https://github.com/rsmbl/Resemble.js)
- Percy (https://percy.io) - Commercial option

### 3. Dashboard Integration

**Data Sources**:
- `test-manifest.json` for summary metrics
- `visual-regression/index.json` for screenshot catalog
- `coverage/coverage.json` for coverage trends
- Playwright JSON reports for test execution details

**Recommended Stack**:
- Grafana + Prometheus for metrics
- Custom React dashboard for screenshot comparison
- Historical trend analysis (test duration, failure rates, coverage)

### 4. Alerting & Notifications

**Alert Conditions**:
```javascript
{
  "testsFailed": summary.e2e.failed > 0 || summary.unit.failed > 0,
  "coverageDropped": currentCoverage < baselineCoverage - 5,
  "visualChanges": visualDiffCount > 10,
  "testDurationIncreased": currentDuration > baselineDuration * 1.5
}
```

**Notification Channels**:
- Slack/Discord webhooks
- Email reports
- GitHub PR comments
- Status badges

## Usage Examples

### Generate Test Manifest

```bash
# After test run completes
./tools/generate-test-manifest.sh test-reports artifacts-20251113_220000

# Output: test-reports/artifacts-20251113_220000/test-manifest.json
```

### Query Test Results

```bash
# Get latest test status
LATEST_MANIFEST=$(find test-reports/artifacts-*/test-manifest.json | sort -r | head -1)
jq '.summary.e2e.status' "$LATEST_MANIFEST"
# Output: "passed"

# Get screenshot count
jq '.artifacts.visualRegression.screenshots' "$LATEST_MANIFEST"
# Output: 252

# Get failed tests
jq '.summary | to_entries | map(select(.value.failed > 0))' "$LATEST_MANIFEST"
```

### Compare Test Runs

```bash
# Compare two test runs
LATEST=$(find test-reports/artifacts-*/test-manifest.json | sort -r | head -1)
PREVIOUS=$(find test-reports/artifacts-*/test-manifest.json | sort -r | head -2 | tail -1)

echo "Latest E2E: $(jq -r '.summary.e2e.status' $LATEST)"
echo "Previous E2E: $(jq -r '.summary.e2e.status' $PREVIOUS)"

# Duration comparison
jq -s '.[0].summary.e2e.duration, .[1].summary.e2e.duration' "$LATEST" "$PREVIOUS"
```

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Test & Report to DevOps

on:
  push:
    branches: [main, develop]
  pull_request:

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Run E2E Tests
        run: ./tools/test-vm-e2e.sh

      - name: Generate Manifest
        run: ./tools/generate-test-manifest.sh

      - name: Upload Artifacts
        uses: actions/upload-artifact@v3
        with:
          name: test-artifacts
          path: test-reports/artifacts-*

      - name: Notify DevOps Repo
        run: |
          MANIFEST=$(find test-reports/artifacts-*/test-manifest.json | sort -r | head -1)
          curl -X POST ${{ secrets.DEVOPS_WEBHOOK_URL }} \
            -H "Content-Type: application/json" \
            -d @"$MANIFEST"
```

## Data Retention

**Recommendations**:
- Keep artifacts for last 30 test runs
- Archive baselines for each release
- Store compressed screenshots after 7 days
- Retain manifests and logs for 90 days

## Security Considerations

- Sanitize any credentials/secrets from logs
- Restrict access to test artifacts (may contain sensitive UI)
- Use secure transfer methods (HTTPS, SSH)
- Implement authentication for DevOps webhooks

## Future Enhancements

- [ ] Real-time streaming of test progress to DevOps
- [ ] Automatic baseline promotion on successful PR merge
- [ ] Machine learning for anomaly detection in metrics
- [ ] Performance profiling data collection
- [ ] Accessibility test results integration
- [ ] Security scan results (OWASP ZAP, etc.)

## Support

For issues with data format or integration:
- GraphDone-Core repository: Test execution and data generation
- GraphDone-DevOps repository: Data consumption and analysis
