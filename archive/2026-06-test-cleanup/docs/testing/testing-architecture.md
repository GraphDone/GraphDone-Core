# GraphDone Testing Architecture

## Overview

GraphDone uses a unified testing framework that integrates multiple test types into a single comprehensive test runner with standardized HTML reporting.

## Test Integration Points

### 1. Main Test Runner (`run-all-tests.js`)

The central test orchestrator that:
- Runs all test suites in priority order
- Handles both Playwright tests and shell scripts
- Generates unified HTML reports
- Tracks results across all test types

### 2. Test Suite Configuration

```javascript
const TEST_SUITES = [
  {
    name: 'Installation Script Validation',
    command: './scripts/test-installation-simple.sh',
    priority: 0,
    critical: true,
    type: 'shell',           // Indicates shell script test
    parser: 'installation'   // Custom output parser
  },
  {
    name: 'TLS/SSL Integration',
    command: 'npx playwright test tests/e2e/tls-integration.spec.ts',
    priority: 1,
    critical: true
    // Default type is 'playwright'
  }
  // ... more test suites
];
```

### 3. Test Types Supported

#### Playwright E2E Tests
- Standard browser automation tests
- JSON reporter output
- Automatic screenshot capture
- Cross-browser testing

#### Shell Script Tests
- Installation validation
- System integration tests  
- Custom output parsing
- Docker-based testing

#### Unit Tests
- Turbo monorepo test runner
- Package-level testing
- Coverage reports

## Running Tests

### Individual Test Commands

```bash
# Run only installation tests
npm run test:installation

# Run comprehensive test suite
npm run test:comprehensive

# Run specific E2E tests
npm run test:e2e

# Run unit tests
npm run test:unit

# View test report
npm run test:report
```

### Test Output Structure

All test results are stored in `test-results/` (gitignored):

```
test-results/
├── installation/          # Installation test logs
│   ├── *.log             # Individual distribution logs
│   ├── report.html       # HTML report
│   └── SUMMARY.md        # Summary documentation
├── reports/              # Playwright HTML reports
├── screenshots/          # Test failure screenshots
└── reports/
    └── index.html        # Unified test report
```

## Adding New Test Types

To add a new test type:

1. **Create Test Script**: Add to `scripts/` or `tests/`
2. **Add to TEST_SUITES**: Update `run-all-tests.js`
3. **Define Parser** (if shell script): Add custom output parser
4. **Update package.json**: Add convenience script

Example:

```javascript
// In run-all-tests.js
{
  name: 'Performance Benchmarks',
  command: './scripts/test-performance.sh',
  priority: 10,
  critical: false,
  type: 'shell',
  parser: 'benchmark'  // Custom parser for benchmark output
}
```

## Unified Report Generation

The HTML report generator (`generateHTMLReport()`) creates a consistent report that includes:

- Test summary cards (total, passed, failed, skipped)
- Individual suite results with timing
- Error details for failures
- Browser compatibility matrix
- System information
- Visual progress indicators

### Report Features

- **Responsive Design**: Works on all screen sizes
- **GraphDone Branding**: Consistent visual language
- **Interactive Elements**: Expandable error details
- **Performance Metrics**: Test duration tracking
- **Priority Indication**: Critical vs non-critical tests

## CI/CD Integration

The test framework integrates with GitHub Actions:

```yaml
- name: Run comprehensive tests
  run: npm run test:comprehensive
  
- name: Upload test results
  uses: actions/upload-artifact@v4
  with:
    name: test-results
    path: test-results/
```

## Best Practices

1. **Test Organization**: Group related tests in suites
2. **Output Consistency**: Use standardized output formats
3. **Error Handling**: Graceful failures with clear messages
4. **Report Storage**: Always output to `test-results/`
5. **Parser Design**: Keep parsers simple and regex-based
6. **Priority Order**: Run critical tests first

## Extending the Framework

### Adding Custom Parsers

For shell scripts with unique output formats:

```javascript
if (suite.parser === 'custom') {
  // Parse custom output format
  const customMatch = result.match(/Custom pattern: (\d+)/);
  suiteResult.custom = customMatch ? parseInt(customMatch[1]) : 0;
}
```

### Adding Report Sections

To add new sections to the HTML report, modify `generateHTMLReport()`:

```javascript
// Add custom section
htmlContent += `
  <div class="custom-section">
    <h2>Custom Metrics</h2>
    <!-- Custom content here -->
  </div>
`;
```

## Maintenance

- **Test Updates**: Keep TEST_SUITES array current
- **Parser Updates**: Adjust regex patterns as output changes
- **Report Template**: Update HTML/CSS for new requirements
- **Documentation**: Keep this file updated with changes