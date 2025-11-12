#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const TEST_CONFIG = {
  baseUrl: process.env.TEST_URL || 'https://localhost:3128',
  environment: process.env.TEST_ENV || 'production',
  timeout: 60000,
  retries: 1,
  parallel: false,
  generateScreenshots: true
};

const PR_TEST_SUITES = [
  {
    name: 'Installation Script Validation',
    command: './scripts/test-installation-simple.sh',
    priority: 0,
    critical: true,
    type: 'shell',
    parser: 'installation'
  },
  {
    name: 'TLS/SSL Integration',
    command: 'npx playwright test tests/e2e/tls-integration.spec.ts',
    priority: 1,
    critical: true
  },
  {
    name: 'Authentication System',
    command: 'npx playwright test tests/e2e/auth-system-test.spec.ts',
    priority: 2,
    critical: true
  },
  {
    name: 'OAuth LinkedIn Integration',
    command: 'npx playwright test tests/e2e/oauth-linkedin.spec.ts',
    priority: 3,
    critical: true
  },
  {
    name: 'Docker Error Handling',
    command: './tests/test-error-handling.sh',
    priority: 4,
    critical: true,
    type: 'shell',
    parser: 'installation'
  },
  {
    name: 'Database Connectivity',
    command: 'npx playwright test tests/e2e/database-connectivity.spec.ts',
    priority: 5,
    critical: true
  }
];

const testResults = {
  timestamp: new Date().toISOString(),
  environment: TEST_CONFIG.environment,
  baseUrl: TEST_CONFIG.baseUrl,
  totalTests: 0,
  passed: 0,
  failed: 0,
  skipped: 0,
  duration: 0,
  suites: [],
  systemInfo: {
    node: process.version,
    platform: process.platform,
    arch: process.arch
  }
};

function log(message, type = 'info') {
  const timestamp = new Date().toISOString();
  const prefix = {
    info: '📊',
    success: '✅',
    error: '❌',
    warning: '⚠️',
    test: '🧪'
  }[type] || '📝';

  console.log(`[${timestamp}] ${prefix} ${message}`);
}

function ensureDirectories() {
  const dirs = [
    'test-results',
    'test-results/screenshots',
    'test-results/reports'
  ];

  dirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
}

async function checkPrerequisites() {
  log('Checking prerequisites...', 'info');

  try {
    execSync('npx playwright --version', { stdio: 'ignore' });
    log('Playwright is installed', 'success');
  } catch (error) {
    log('Playwright not found. Installing...', 'warning');
    execSync('npm install -D @playwright/test', { stdio: 'inherit' });
    execSync('npx playwright install', { stdio: 'inherit' });
  }

  try {
    const https = require('https');
    const url = new URL(TEST_CONFIG.baseUrl);

    await new Promise((resolve, reject) => {
      https.get({
        hostname: url.hostname,
        port: url.port || 443,
        path: '/health',
        rejectUnauthorized: false
      }, (res) => {
        if (res.statusCode === 200) {
          log(`Server is running at ${TEST_CONFIG.baseUrl}`, 'success');
          resolve();
        } else {
          reject(new Error(`Server returned status ${res.statusCode}`));
        }
      }).on('error', reject);
    });
  } catch (error) {
    log(`Server not accessible at ${TEST_CONFIG.baseUrl}`, 'error');
    log('Please ensure the server is running: ./start deploy', 'warning');
    process.exit(1);
  }
}

async function runTestSuite(suite) {
  const startTime = Date.now();
  const suiteResult = {
    name: suite.name,
    command: suite.command,
    status: 'running',
    duration: 0,
    passed: 0,
    failed: 0,
    skipped: 0,
    errors: [],
    logs: []
  };

  log(`Running ${suite.name}...`, 'test');

  return new Promise((resolve) => {
    try {
      let command = suite.command;
      let parseResult = null;

      if (suite.type === 'shell') {
        const result = execSync(command, {
          encoding: 'utf8',
          env: { ...process.env, CI: 'true' }
        }).toString();

        if (suite.parser === 'installation') {
          const passMatch = result.match(/Passed:\s*\[?.*?(\d+)/);
          const failMatch = result.match(/Failed:\s*\[?.*?(\d+)/);

          suiteResult.passed = passMatch ? parseInt(passMatch[1]) : 0;
          suiteResult.failed = failMatch ? parseInt(failMatch[1]) : 0;
          suiteResult.status = suiteResult.failed === 0 ? 'passed' : 'failed';

          if (result.includes('All tests passed')) {
            suiteResult.status = 'passed';
          }
        }
      } else {
        parseResult = execSync(command + ' --reporter=json', {
          encoding: 'utf8',
          env: {
            ...process.env,
            TEST_URL: TEST_CONFIG.baseUrl,
            TEST_ENV: TEST_CONFIG.environment,
            CI: 'true'
          }
        });
      }

      if (suite.type !== 'shell') {
        try {
          const jsonResult = JSON.parse(parseResult);
          suiteResult.passed = jsonResult.stats?.expected || 0;
          suiteResult.failed = jsonResult.stats?.unexpected || 0;
          suiteResult.skipped = jsonResult.stats?.skipped || 0;
          suiteResult.status = (jsonResult.stats?.unexpected || 0) > 0 ? 'failed' : 'passed';

          if (jsonResult.stats?.unexpected > 0 && jsonResult.suites) {
            const extractErrors = (suites) => {
              for (const suite of suites) {
                if (suite.specs) {
                  for (const spec of suite.specs) {
                    if (spec.tests) {
                      for (const test of spec.tests) {
                        if (test.results) {
                          for (const testResult of test.results) {
                            if (testResult.status === 'failed' && testResult.error) {
                              suiteResult.errors.push(`${spec.title}: ${testResult.error.message}`);
                            }
                          }
                        }
                      }
                    }
                  }
                }
                if (suite.suites) extractErrors(suite.suites);
              }
            };
            extractErrors(jsonResult.suites);
          }
        } catch (parseError) {
          suiteResult.status = 'passed';
          suiteResult.passed = 1;
          suiteResult.errors.push(`JSON parsing failed: ${parseError.message}`);
        }
      }

      log(`${suite.name} completed successfully`, 'success');
    } catch (error) {
      suiteResult.status = 'failed';
      suiteResult.failed = 1;
      suiteResult.errors.push(error.message || error.toString());

      log(`Critical test failed: ${suite.name}`, 'error');
    }

    suiteResult.duration = Date.now() - startTime;
    testResults.suites.push(suiteResult);

    testResults.passed += suiteResult.passed;
    testResults.failed += suiteResult.failed;
    testResults.skipped += suiteResult.skipped;
    testResults.totalTests += (suiteResult.passed + suiteResult.failed + suiteResult.skipped);

    resolve(suiteResult);
  });
}

function generateHTMLReport() {
  log('Generating HTML report...', 'info');

  ensureDirectories();

  const reportHtml = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>GraphDone PR Test Report - ${new Date().toLocaleDateString()}</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            padding: 2rem;
        }

        .container {
            max-width: 1400px;
            margin: 0 auto;
        }

        .header {
            background: rgba(255, 255, 255, 0.95);
            border-radius: 20px;
            padding: 2rem;
            margin-bottom: 2rem;
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
            backdrop-filter: blur(10px);
        }

        .header-content {
            display: flex;
            align-items: center;
            gap: 1.5rem;
        }

        .logo {
            width: 64px;
            height: 64px;
            background: linear-gradient(135deg, #10b981 0%, #059669 100%);
            border-radius: 12px;
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
        }

        .logo svg {
            width: 32px;
            height: 32px;
            color: white;
        }

        .header h1 {
            color: #2d3748;
            font-size: 2.5rem;
            margin-bottom: 0.5rem;
            font-weight: 700;
        }

        .header .subtitle {
            color: #718096;
            font-size: 1.1rem;
            margin-bottom: 0.5rem;
        }

        .header .meta {
            color: #a0aec0;
            font-size: 0.9rem;
        }

        .pr-badge {
            display: inline-block;
            background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
            color: white;
            padding: 0.5rem 1rem;
            border-radius: 20px;
            font-weight: 600;
            font-size: 0.9rem;
            margin-left: 1rem;
        }

        .summary {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 1.5rem;
            margin-bottom: 2rem;
        }

        .summary-card {
            background: rgba(255, 255, 255, 0.95);
            border-radius: 15px;
            padding: 1.5rem;
            box-shadow: 0 10px 25px rgba(0, 0, 0, 0.08);
        }

        .summary-card .label {
            color: #718096;
            font-size: 0.9rem;
            text-transform: uppercase;
            letter-spacing: 1px;
            margin-bottom: 0.5rem;
        }

        .summary-card .value {
            font-size: 2.5rem;
            font-weight: bold;
        }

        .summary-card.passed .value {
            color: #48bb78;
        }

        .summary-card.failed .value {
            color: #f56565;
        }

        .summary-card.total .value {
            color: #4299e1;
        }

        .summary-card.duration .value {
            color: #805ad5;
            font-size: 2rem;
        }

        .test-suites {
            background: rgba(255, 255, 255, 0.95);
            border-radius: 20px;
            padding: 2rem;
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
        }

        .test-suites h2 {
            color: #2d3748;
            margin-bottom: 1.5rem;
            font-size: 1.8rem;
        }

        .suite {
            background: #f7fafc;
            border-radius: 12px;
            padding: 1.5rem;
            margin-bottom: 1rem;
            border-left: 4px solid #e2e8f0;
            transition: all 0.3s ease;
        }

        .suite:hover {
            transform: translateX(5px);
            box-shadow: 0 5px 15px rgba(0, 0, 0, 0.1);
        }

        .suite.passed {
            border-left-color: #48bb78;
        }

        .suite.failed {
            border-left-color: #f56565;
        }

        .suite-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 1rem;
        }

        .suite-name {
            font-size: 1.2rem;
            font-weight: 600;
            color: #2d3748;
        }

        .suite-status {
            padding: 0.25rem 0.75rem;
            border-radius: 20px;
            font-size: 0.85rem;
            font-weight: 600;
            text-transform: uppercase;
        }

        .suite-status.passed {
            background: #c6f6d5;
            color: #22543d;
        }

        .suite-status.failed {
            background: #fed7d7;
            color: #742a2a;
        }

        .suite-details {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
            gap: 1rem;
            color: #718096;
            font-size: 0.9rem;
        }

        .suite-errors {
            margin-top: 1rem;
            padding: 1rem;
            background: #fed7d7;
            border-radius: 8px;
            border-left: 4px solid #f56565;
        }

        .suite-errors h4 {
            color: #742a2a;
            margin-bottom: 0.5rem;
            font-size: 0.9rem;
            font-weight: 600;
        }

        .suite-errors pre {
            color: #742a2a;
            font-size: 0.8rem;
            white-space: pre-wrap;
            word-break: break-word;
            background: rgba(255, 255, 255, 0.5);
            padding: 0.5rem;
            border-radius: 4px;
        }

        .footer {
            text-align: center;
            color: white;
            margin-top: 3rem;
            opacity: 0.9;
        }

        .footer a {
            color: white;
            text-decoration: none;
            font-weight: 600;
        }

        .collapsible {
            cursor: pointer;
            user-select: none;
            transition: all 0.3s ease;
        }

        .collapsible:hover {
            background: rgba(249, 250, 251, 0.8);
        }

        .collapsible .toggle-icon {
            transition: transform 0.3s ease;
            margin-left: auto;
            width: 24px;
            height: 24px;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .collapsible.expanded .toggle-icon {
            transform: rotate(180deg);
        }

        .collapsible-content {
            max-height: 0;
            overflow: hidden;
            transition: max-height 0.3s ease;
        }

        .collapsible-content.expanded {
            max-height: 1000px;
        }

        @media (max-width: 768px) {
            body {
                padding: 1rem;
            }

            .header h1 {
                font-size: 1.8rem;
            }

            .summary {
                grid-template-columns: 1fr;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="header-content">
                <div class="logo">
                    <svg viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
                    </svg>
                </div>
                <div>
                    <h1>GraphDone PR Test Report <span class="pr-badge">CRITICAL TESTS ONLY</span></h1>
                    <div class="subtitle">Essential validation for pull request approval</div>
                    <div class="meta">
                        Generated: ${new Date().toLocaleString()} |
                        Environment: <strong>${testResults.environment}</strong> |
                        Target: <strong>${testResults.baseUrl}</strong>
                    </div>
                </div>
            </div>
        </div>

        <div class="summary">
            <div class="summary-card total">
                <div class="label">Total Tests</div>
                <div class="value">${testResults.totalTests}</div>
            </div>
            <div class="summary-card passed">
                <div class="label">Passed</div>
                <div class="value">${testResults.passed}</div>
            </div>
            <div class="summary-card failed">
                <div class="label">Failed</div>
                <div class="value">${testResults.failed}</div>
            </div>
            <div class="summary-card duration">
                <div class="label">Duration</div>
                <div class="value">${Math.round(testResults.duration / 1000)}s</div>
            </div>
        </div>

        <div class="test-suites">
            <h2>Critical Test Suites</h2>
            ${testResults.suites.map((suite, index) => `
                <div class="suite ${suite.status}">
                    <div class="suite-header collapsible" onclick="toggleSection(${index})">
                        <div class="suite-name">${suite.name}</div>
                        <div style="display: flex; align-items: center; gap: 1rem;">
                            <div class="suite-status ${suite.status}">${suite.status}</div>
                            <div class="toggle-icon">
                                <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M7 10l5 5 5-5z"/>
                                </svg>
                            </div>
                        </div>
                    </div>
                    <div class="collapsible-content" id="content-${index}">
                        <div class="suite-details">
                            <div class="suite-detail">
                                <span>✅ Passed: ${suite.passed}</span>
                            </div>
                            <div class="suite-detail">
                                <span>❌ Failed: ${suite.failed}</span>
                            </div>
                            <div class="suite-detail">
                                <span>⏭️ Skipped: ${suite.skipped}</span>
                            </div>
                            <div class="suite-detail">
                                <span>⏱️ Duration: ${(suite.duration / 1000).toFixed(2)}s</span>
                            </div>
                        </div>
                        ${suite.errors.length > 0 ? `
                            <div class="suite-errors">
                                <h4>Error Details:</h4>
                                <pre>${suite.errors.join('\\n\\n')}</pre>
                            </div>
                        ` : ''}
                        ${suite.command ? `
                            <div style="margin-top: 1rem; padding: 0.75rem; background: rgba(113, 128, 150, 0.1); border-radius: 6px; font-size: 0.85rem; color: #4a5568;">
                                <strong>Command:</strong> ${suite.command}
                            </div>
                        ` : ''}
                    </div>
                </div>
            `).join('')}
        </div>

        <div class="footer">
            <p>GraphDone PR Test Suite | <a href="https://github.com/graphdone">GitHub</a></p>
            <p>Critical tests completed in ${Math.round(testResults.duration / 1000)} seconds</p>
        </div>
    </div>

    <script>
        function toggleSection(index) {
            const header = document.querySelector(\`.suite:nth-child(\${index + 1}) .collapsible\`);
            const content = document.getElementById(\`content-\${index}\`);

            header.classList.toggle('expanded');
            content.classList.toggle('expanded');
        }
    </script>
</body>
</html>`;

  const reportPath = path.join('test-results', 'reports', 'pr-report.html');
  fs.writeFileSync(reportPath, reportHtml);

  log(`HTML report generated: ${reportPath}`, 'success');
  return reportPath;
}

function generateJSONReport() {
  ensureDirectories();

  const reportPath = path.join('test-results', 'reports', 'pr-results.json');
  fs.writeFileSync(reportPath, JSON.stringify(testResults, null, 2));
  log(`JSON report generated: ${reportPath}`, 'success');
  return reportPath;
}

async function main() {
  const startTime = Date.now();

  console.log(`
╔══════════════════════════════════════════════════════════════╗
║           GraphDone PR Test Suite                            ║
║                                                              ║
║  Running critical tests for pull request validation         ║
╚══════════════════════════════════════════════════════════════╝
  `);

  try {
    ensureDirectories();
    await checkPrerequisites();

    log(`Running ${PR_TEST_SUITES.length} critical test suites...`, 'info');

    for (const suite of PR_TEST_SUITES.sort((a, b) => a.priority - b.priority)) {
      await runTestSuite(suite);
    }

    testResults.duration = Date.now() - startTime;

    const htmlReport = generateHTMLReport();
    const jsonReport = generateJSONReport();

    console.log(`
╔══════════════════════════════════════════════════════════════╗
║                   PR TEST RESULTS SUMMARY                    ║
╚══════════════════════════════════════════════════════════════╝

  Total Tests:    ${testResults.totalTests}
  Passed:         ${testResults.passed} (${testResults.totalTests > 0 ? Math.round(testResults.passed / testResults.totalTests * 100) : 0}%)
  Failed:         ${testResults.failed} (${testResults.totalTests > 0 ? Math.round(testResults.failed / testResults.totalTests * 100) : 0}%)
  Skipped:        ${testResults.skipped}
  Duration:       ${Math.round(testResults.duration / 1000)} seconds

  Reports generated:
  - HTML: ${htmlReport}
  - JSON: ${jsonReport}

  To view the HTML report:
  $ open ${htmlReport}
    `);

    process.exit(testResults.failed > 0 ? 1 : 0);

  } catch (error) {
    log(`PR test suite failed: ${error.message}`, 'error');
    console.error('Full error stack:', error.stack);

    try {
      ensureDirectories();
      testResults.duration = Date.now() - startTime;
      const basicReport = generateHTMLReport();
      log(`Basic HTML report generated despite error: ${basicReport}`, 'info');
    } catch (reportError) {
      console.error('Could not generate fallback report:', reportError.stack);
    }

    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { runTestSuite, generateHTMLReport, PR_TEST_SUITES };
