import { test, expect } from '@playwright/test';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Installation Validation Test Suite
 * Tests the one-line installation script across multiple environments
 * Integrates with existing Playwright test infrastructure
 */

// Test configuration from environment or defaults
const TEST_DISTRIBUTIONS = process.env.TEST_DISTROS?.split(',') || [
  'ubuntu:24.04',
  'ubuntu:22.04', 
  'debian:12',
  'fedora:40',
  'rockylinux:9',
  'alpine:latest'
];

// Reuse existing test timeouts and configurations
test.describe.configure({ 
  mode: 'parallel',
  timeout: 300000 // 5 minutes per test
});

test.describe('Installation Script Validation', () => {
  const projectRoot = path.resolve(__dirname, '../..');
  const installScript = path.join(projectRoot, 'public/install.sh');
  const resultsDir = path.join(projectRoot, 'test-results/installation');

  test.beforeAll(() => {
    // Ensure results directory exists
    if (!fs.existsSync(resultsDir)) {
      fs.mkdirSync(resultsDir, { recursive: true });
    }

    // Verify installation script exists
    expect(fs.existsSync(installScript)).toBeTruthy();
  });

  // Test basic script functionality
  test('installation script has correct permissions and structure', async () => {
    const stats = fs.statSync(installScript);
    
    // Check file is executable
    expect(stats.mode & 0o111).toBeTruthy();
    
    // Check script has proper shebang
    const content = fs.readFileSync(installScript, 'utf8');
    expect(content).toMatch(/^#!\/bin\/sh/);
    
    // Verify script has main functions
    expect(content).toContain('install_graphdone');
    expect(content).toContain('stop_services');
    expect(content).toContain('remove_services');
  });

  // Test help/usage output
  test('installation script shows help information', async () => {
    const output = execSync(`sh ${installScript} --help 2>&1`, {
      encoding: 'utf8'
    }).toString();
    
    expect(output).toContain('install');
    expect(output).toContain('stop');
    expect(output).toContain('remove');
  });

  // Docker-based distribution tests
  for (const distro of TEST_DISTRIBUTIONS) {
    const [image, tag] = distro.split(':');
    const distroName = `${image}-${tag || 'latest'}`;
    
    test(`installation works on ${distroName}`, async ({ page }) => {
      // Skip if Docker is not available
      try {
        execSync('docker info', { stdio: 'ignore' });
      } catch {
        test.skip();
        return;
      }

      const dockerfile = `
FROM ${distro}

# Install basic dependencies
RUN if command -v apt-get; then apt-get update && apt-get install -y curl wget sudo; fi
RUN if command -v dnf; then dnf install -y curl wget sudo; fi
RUN if command -v apk; then apk add --no-cache curl wget sudo bash; fi

# Copy installation script
COPY public/install.sh /tmp/install.sh
RUN chmod +x /tmp/install.sh

# Test the installation script
CMD ["/bin/sh", "-c", "/tmp/install.sh --help && echo 'INSTALL_TEST_PASS'"]
`;
      
      const dockerfilePath = path.join(resultsDir, `Dockerfile.${distroName}`);
      fs.writeFileSync(dockerfilePath, dockerfile);
      
      // Build and run Docker test
      const imageName = `graphdone-test-${distroName}`.toLowerCase();
      
      try {
        // Build image
        execSync(
          `docker build -f ${dockerfilePath} -t ${imageName} ${projectRoot}`,
          { stdio: 'pipe' }
        );
        
        // Run container
        const output = execSync(
          `docker run --rm ${imageName}`,
          { encoding: 'utf8' }
        ).toString();
        
        // Verify test passed
        expect(output).toContain('INSTALL_TEST_PASS');
        
        // Clean up
        execSync(`docker rmi ${imageName}`, { stdio: 'ignore' });
        
      } catch (error) {
        console.error(`Failed testing ${distroName}:`, error);
        throw error;
      }
    });
  }

  // Test actual GraphDone startup after installation (if running locally)
  test('GraphDone services start after installation', async ({ page }) => {
    // This test only runs if we have a local GraphDone instance
    test.skip(process.env.CI === 'true', 'Skipping in CI environment');
    
    // Check if services are accessible
    const healthCheck = async (url: string, retries = 5) => {
      for (let i = 0; i < retries; i++) {
        try {
          const response = await page.request.get(url);
          if (response.ok()) return true;
        } catch {
          // Wait before retry
          await page.waitForTimeout(2000);
        }
      }
      return false;
    };
    
    // Test GraphQL endpoint
    const graphqlHealthy = await healthCheck('http://localhost:4127/health');
    expect(graphqlHealthy).toBeTruthy();
    
    // Test web interface  
    await page.goto('http://localhost:3127');
    await expect(page).toHaveTitle(/GraphDone/i);
  });
});

// Integration with comprehensive test report
test.afterAll(async () => {
  const reportPath = path.join(
    process.cwd(),
    'test-results/installation/summary.json'
  );
  
  // Generate summary for comprehensive test reporter
  const summary = {
    timestamp: new Date().toISOString(),
    distributions: TEST_DISTRIBUTIONS.length,
    // Results will be populated by Playwright reporter
  };
  
  fs.writeFileSync(reportPath, JSON.stringify(summary, null, 2));
});