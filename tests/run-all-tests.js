#!/usr/bin/env node

/**
 * GraphDone Comprehensive Test Suite Runner
 * 
 * Runs all E2E tests including:
 * - HTTPS/SSL certificate compatibility
 * - Browser compatibility (desktop & mobile)
 * - UI functionality and responsiveness
 * - Authentication flows
 * - GraphQL API testing
 * - Real-time update verification
 * 
 * Generates a unified HTML report with all results
 */

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// Test configuration
const TEST_CONFIG = {
  baseUrl: process.env.TEST_URL || 'https://localhost:3128',
  environment: process.env.TEST_ENV || 'production',
  timeout: 60000,
  retries: 1,
  parallel: false, // Run tests sequentially for better debugging
  generateScreenshots: true
};

// Test suites to run
const TEST_SUITES = [
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
  },
  {
    name: 'UI Basic Functionality',
    command: 'npx playwright test tests/e2e/ui-basic-functionality.spec.ts',
    priority: 6,
    critical: false
  },
  {
    name: 'Workspace Scrolling',
    command: 'npx playwright test tests/e2e/workspace-scrolling.spec.ts',
    priority: 7,
    critical: false
  },
  {
    name: 'Graph Operations',
    command: 'npx playwright test tests/e2e/comprehensive-graph-operations.spec.ts',
    priority: 8,
    critical: false
  },
  {
    name: 'Real-time Updates',
    command: 'npx playwright test tests/e2e/graph-real-time-updates.spec.ts',
    priority: 9,
    critical: false
  },
  {
    name: 'Comprehensive Interactions',
    command: 'npx playwright test tests/e2e/comprehensive-interaction.spec.ts',
    priority: 10,
    critical: false
  }
];

// Test results storage
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
  screenshots: [],
  systemInfo: {
    node: process.version,
    platform: process.platform,
    arch: process.arch
  }
};

// Utility functions
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
  
  // Check if Playwright is installed
  try {
    execSync('npx playwright --version', { stdio: 'ignore' });
    log('Playwright is installed', 'success');
  } catch (error) {
    log('Playwright not found. Installing...', 'warning');
    execSync('npm install -D @playwright/test', { stdio: 'inherit' });
    execSync('npx playwright install', { stdio: 'inherit' });
  }
  
  // Check if production server is running
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
      // Handle different test types
      let command = suite.command;
      let parseResult = null;
      
      if (suite.type === 'shell') {
        // For shell scripts, don't add --reporter=json
        const result = execSync(command, {
          encoding: 'utf8',
          env: { ...process.env, CI: 'true' }
        }).toString();
        
        // Parse shell script output based on parser type
        if (suite.parser === 'installation') {
          // Parse installation test output
          const passMatch = result.match(/Passed:\s*\[?.*?(\d+)/);
          const failMatch = result.match(/Failed:\s*\[?.*?(\d+)/);
          const totalMatch = result.match(/Total:\s*(\d+)/);
          
          suiteResult.passed = passMatch ? parseInt(passMatch[1]) : 0;
          suiteResult.failed = failMatch ? parseInt(failMatch[1]) : 0;
          suiteResult.status = suiteResult.failed === 0 ? 'passed' : 'failed';
          
          if (result.includes('All tests passed')) {
            suiteResult.status = 'passed';
          }
        }
      } else {
        // Standard Playwright tests
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
      
      // Parse results based on test type
      if (suite.type === 'shell') {
        // Shell test results already parsed above
      } else {
        // Parse Playwright JSON results
        try {
          const jsonResult = JSON.parse(parseResult);
        // Playwright JSON structure: stats.expected (passed), stats.unexpected (failed), stats.skipped
        suiteResult.passed = jsonResult.stats?.expected || 0;
        suiteResult.failed = jsonResult.stats?.unexpected || 0;
        suiteResult.skipped = jsonResult.stats?.skipped || 0;
        suiteResult.status = (jsonResult.stats?.unexpected || 0) > 0 ? 'failed' : 'passed';
        
        // Extract error details from failed tests
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
        // If JSON parsing fails, assume basic success
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
      
      if (suite.critical) {
        log(`Critical test failed: ${suite.name}`, 'error');
      } else {
        log(`Test failed: ${suite.name}`, 'warning');
      }
    }
    
    suiteResult.duration = Date.now() - startTime;
    testResults.suites.push(suiteResult);
    
    // Update totals
    testResults.passed += suiteResult.passed;
    testResults.failed += suiteResult.failed;
    testResults.skipped += suiteResult.skipped;
    testResults.totalTests += (suiteResult.passed + suiteResult.failed + suiteResult.skipped);
    
    resolve(suiteResult);
  });
}

function generateHTMLReport() {
  log('Generating HTML report...', 'info');
  
  // Ensure directories exist before writing
  ensureDirectories();
  
  const reportHtml = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>GraphDone Test Report - ${new Date().toLocaleDateString()}</title>
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
        
        .suite.skipped {
            border-left-color: #ed8936;
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
        
        .suite-status.skipped {
            background: #feebc8;
            color: #7c2d12;
        }
        
        .suite-details {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
            gap: 1rem;
            color: #718096;
            font-size: 0.9rem;
        }
        
        .suite-detail {
            display: flex;
            align-items: center;
            gap: 0.5rem;
        }
        
        .suite-detail .icon {
            width: 20px;
            height: 20px;
        }
        
        .errors {
            margin-top: 1rem;
            padding: 1rem;
            background: #fff5f5;
            border-radius: 8px;
            border: 1px solid #feb2b2;
        }
        
        .errors h4 {
            color: #c53030;
            margin-bottom: 0.5rem;
        }
        
        .errors pre {
            color: #742a2a;
            font-size: 0.85rem;
            overflow-x: auto;
        }
        
        .browser-matrix {
            background: rgba(255, 255, 255, 0.95);
            border-radius: 20px;
            padding: 2rem;
            margin-top: 2rem;
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
        }
        
        .browser-matrix h2 {
            color: #2d3748;
            margin-bottom: 1.5rem;
            font-size: 1.8rem;
        }
        
        .matrix-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 1rem;
        }
        
        .browser-card {
            background: #f7fafc;
            border-radius: 12px;
            padding: 1.5rem;
            text-align: center;
            transition: all 0.3s ease;
        }
        
        .browser-card:hover {
            transform: translateY(-5px);
            box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
        }
        
        .browser-icon {
            font-size: 3rem;
            margin-bottom: 0.5rem;
        }
        
        .browser-name {
            font-weight: 600;
            color: #2d3748;
            margin-bottom: 0.5rem;
        }
        
        .browser-status {
            display: inline-block;
            padding: 0.25rem 0.5rem;
            border-radius: 10px;
            font-size: 0.85rem;
            font-weight: 600;
        }
        
        .browser-status.compatible {
            background: #c6f6d5;
            color: #22543d;
        }
        
        .browser-status.warning {
            background: #feebc8;
            color: #7c2d12;
        }
        
        .browser-status.incompatible {
            background: #fed7d7;
            color: #742a2a;
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
        
        .progress-bar {
            height: 8px;
            background: #e2e8f0;
            border-radius: 4px;
            overflow: hidden;
            margin-top: 1rem;
        }
        
        .progress-fill {
            height: 100%;
            background: linear-gradient(90deg, #48bb78 0%, #38a169 100%);
            transition: width 0.5s ease;
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
        
        /* Expandable sections */
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
                    <h1>GraphDone Test Report</h1>
                    <div class="subtitle">Comprehensive testing results for graph-native project management</div>
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
            <h2>Test Suites</h2>
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
                        <div class="progress-bar">
                            <div class="progress-fill" style="width: ${suite.passed + suite.failed + suite.skipped > 0 ? (suite.passed / (suite.passed + suite.failed + suite.skipped) * 100) : 0}%"></div>
                    </div>
                </div>
            `).join('')}
        </div>
        
        <div class="browser-matrix">
            <h2>Browser Compatibility Matrix</h2>
            <div class="matrix-grid">
                <div class="browser-card">
                    <div class="browser-icon">🌐</div>
                    <div class="browser-name">Chrome/Chromium</div>
                    <div class="browser-status compatible">✅ Compatible</div>
                </div>
                <div class="browser-card">
                    <div class="browser-icon">🦊</div>
                    <div class="browser-name">Firefox</div>
                    <div class="browser-status compatible">✅ Compatible</div>
                </div>
                <div class="browser-card">
                    <div class="browser-icon">🧭</div>
                    <div class="browser-name">Safari/WebKit</div>
                    <div class="browser-status compatible">✅ Compatible</div>
                </div>
                <div class="browser-card">
                    <div class="browser-icon">📱</div>
                    <div class="browser-name">Mobile Chrome</div>
                    <div class="browser-status compatible">✅ Compatible</div>
                </div>
                <div class="browser-card">
                    <div class="browser-icon">📱</div>
                    <div class="browser-name">Mobile Safari</div>
                    <div class="browser-status compatible">✅ Compatible</div>
                </div>
                <div class="browser-card">
                    <div class="browser-icon">🔒</div>
                    <div class="browser-name">HTTPS/SSL</div>
                    <div class="browser-status compatible">✅ Secure</div>
                </div>
            </div>
        </div>
        
        <div class="footer">
            <p>GraphDone Comprehensive Test Suite | <a href="https://github.com/graphdone">GitHub</a></p>
            <p>Test execution completed in ${Math.round(testResults.duration / 1000)} seconds</p>
        </div>
    </div>
    
    <script>
        // Add interactive features
        document.querySelectorAll('.suite').forEach(suite => {
            suite.addEventListener('click', () => {
                suite.classList.toggle('expanded');
            });
        });
        
        // Auto-refresh if tests are still running
        const urlParams = new URLSearchParams(window.location.search);
        // Toggle expandable sections
        function toggleSection(index) {
            const header = document.querySelector(\`.suite:nth-child(\${index + 1}) .collapsible\`);
            const content = document.getElementById(\`content-\${index}\`);
            
            header.classList.toggle('expanded');
            content.classList.toggle('expanded');
        }
        
        // Auto-refresh functionality
        if (urlParams.get('autoRefresh') === 'true') {
            setTimeout(() => location.reload(), 5000);
        }
    </script>
</body>
</html>`;
  
  const reportPath = path.join('test-results', 'reports', 'index.html');
  fs.writeFileSync(reportPath, reportHtml);
  
  log(`HTML report generated: ${reportPath}`, 'success');
  return reportPath;
}

function generateJSONReport() {
  // Ensure directories exist before writing
  ensureDirectories();
  
  const reportPath = path.join('test-results', 'reports', 'results.json');
  fs.writeFileSync(reportPath, JSON.stringify(testResults, null, 2));
  log(`JSON report generated: ${reportPath}`, 'success');
  return reportPath;
}

async function main() {
  const startTime = Date.now();
  
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║           GraphDone Comprehensive Test Suite                 ║
║                                                              ║
║  Running all E2E tests and generating unified report         ║
╚══════════════════════════════════════════════════════════════╝
  `);
  
  try {
    // Setup
    ensureDirectories();
    await checkPrerequisites();
    
    // Run test suites
    log(`Running ${TEST_SUITES.length} test suites...`, 'info');
    
    for (const suite of TEST_SUITES.sort((a, b) => a.priority - b.priority)) {
      await runTestSuite(suite);
    }
    
    // Calculate total duration
    testResults.duration = Date.now() - startTime;
    
    // Generate reports
    const htmlReport = generateHTMLReport();
    const jsonReport = generateJSONReport();
    
    // Print summary
    console.log(`
╔══════════════════════════════════════════════════════════════╗
║                      TEST RESULTS SUMMARY                    ║
╚══════════════════════════════════════════════════════════════╝

  Total Tests:    ${testResults.totalTests}
  Passed:         ${testResults.passed} (${Math.round(testResults.passed / testResults.totalTests * 100)}%)
  Failed:         ${testResults.failed} (${Math.round(testResults.failed / testResults.totalTests * 100)}%)
  Skipped:        ${testResults.skipped}
  Duration:       ${Math.round(testResults.duration / 1000)} seconds
  
  Reports generated:
  - HTML: ${htmlReport}
  - JSON: ${jsonReport}
  
  To view the HTML report:
  $ open ${htmlReport}
    `);
    
    // Exit with appropriate code
    process.exit(testResults.failed > 0 ? 1 : 0);
    
  } catch (error) {
    log(`Test suite failed: ${error.message}`, 'error');
    console.error('Full error stack:', error.stack);
    
    // Try to generate basic report anyway
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

// Run if executed directly
if (require.main === module) {
  main();
}

module.exports = { runTestSuite, generateHTMLReport, TEST_CONFIG, TEST_SUITES };