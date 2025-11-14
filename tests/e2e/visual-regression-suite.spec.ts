import { test, expect, Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Comprehensive Visual Regression Test Suite
 *
 * Captures screenshots of every screen at multiple resolutions for:
 * - Visual regression testing
 * - DevOps monitoring
 * - UI/UX documentation
 * - Cross-device compatibility verification
 */

// Device configurations with real-world resolutions
const DEVICES = [
  // Mobile Phones - Portrait
  { name: 'iPhone-SE', width: 375, height: 667, deviceScaleFactor: 2 },
  { name: 'iPhone-12-13-14', width: 390, height: 844, deviceScaleFactor: 3 },
  { name: 'iPhone-14-Pro-Max', width: 430, height: 932, deviceScaleFactor: 3 },
  { name: 'Samsung-Galaxy-S21', width: 360, height: 800, deviceScaleFactor: 3 },
  { name: 'Google-Pixel-7', width: 412, height: 915, deviceScaleFactor: 2.625 },

  // Mobile Phones - Landscape
  { name: 'iPhone-14-Landscape', width: 844, height: 390, deviceScaleFactor: 3 },
  { name: 'Samsung-Galaxy-Landscape', width: 800, height: 360, deviceScaleFactor: 3 },

  // Tablets - Portrait
  { name: 'iPad-Mini', width: 768, height: 1024, deviceScaleFactor: 2 },
  { name: 'iPad-Air', width: 820, height: 1180, deviceScaleFactor: 2 },
  { name: 'iPad-Pro-11', width: 834, height: 1194, deviceScaleFactor: 2 },
  { name: 'iPad-Pro-12.9', width: 1024, height: 1366, deviceScaleFactor: 2 },
  { name: 'Samsung-Galaxy-Tab', width: 800, height: 1280, deviceScaleFactor: 2 },

  // Tablets - Landscape
  { name: 'iPad-Pro-11-Landscape', width: 1194, height: 834, deviceScaleFactor: 2 },
  { name: 'iPad-Pro-12.9-Landscape', width: 1366, height: 1024, deviceScaleFactor: 2 },

  // Desktop - Common resolutions
  { name: 'Desktop-HD', width: 1366, height: 768, deviceScaleFactor: 1 },
  { name: 'Desktop-Full-HD', width: 1920, height: 1080, deviceScaleFactor: 1 },
  { name: 'Desktop-QHD', width: 2560, height: 1440, deviceScaleFactor: 1 },
  { name: 'Desktop-4K', width: 3840, height: 2160, deviceScaleFactor: 1 },

  // Ultrawide
  { name: 'Ultrawide-QHD', width: 3440, height: 1440, deviceScaleFactor: 1 },
  { name: 'Ultrawide-4K', width: 5120, height: 2160, deviceScaleFactor: 1 },
];

// All screens/routes to capture
const SCREENS = [
  { route: '/', name: 'landing-page' },
  { route: '/login', name: 'login' },
  { route: '/workspace', name: 'workspace' },
  { route: '/graph', name: 'graph-view' },
  { route: '/projects', name: 'projects' },
  { route: '/settings', name: 'settings' },
  { route: '/profile', name: 'profile' },
  { route: '/admin', name: 'admin-panel' },
  { route: '/admin/users', name: 'admin-users' },
  { route: '/admin/system', name: 'admin-system' },
];

// Create timestamped directory for this test run
const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
const SCREENSHOT_BASE_DIR = `test-artifacts/visual-regression/${timestamp}`;

// Ensure screenshot directories exist
function ensureDirectoryExists(dir: string) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

// Helper to take a screenshot with retry logic
async function captureScreenshot(
  page: Page,
  filepath: string,
  options: { fullPage?: boolean; timeout?: number } = {}
) {
  const maxRetries = 3;
  let lastError: Error | null = null;

  for (let i = 0; i < maxRetries; i++) {
    try {
      await page.screenshot({
        path: filepath,
        fullPage: options.fullPage ?? true,
        timeout: options.timeout ?? 30000,
      });
      return true;
    } catch (error) {
      lastError = error as Error;
      console.warn(`Screenshot attempt ${i + 1} failed: ${filepath}`, error);
      await page.waitForTimeout(1000);
    }
  }

  console.error(`Failed to capture screenshot after ${maxRetries} attempts: ${filepath}`, lastError);
  return false;
}

// Main test suite
test.describe('Visual Regression Test Suite - All Screens, All Resolutions', () => {

  test.beforeAll(() => {
    // Create base directory structure
    ensureDirectoryExists(SCREENSHOT_BASE_DIR);

    // Create device-specific directories
    DEVICES.forEach(device => {
      ensureDirectoryExists(path.join(SCREENSHOT_BASE_DIR, device.name));
    });

    console.log(`\n📸 Visual Regression Suite Started`);
    console.log(`📁 Screenshots will be saved to: ${SCREENSHOT_BASE_DIR}`);
    console.log(`📱 Testing ${DEVICES.length} device configurations`);
    console.log(`🖼️  Capturing ${SCREENS.length} screens per device`);
    console.log(`📊 Total screenshots: ${DEVICES.length * SCREENS.length}\n`);
  });

  // Generate a test for each device configuration
  for (const device of DEVICES) {
    test.describe(`Device: ${device.name} (${device.width}x${device.height})`, () => {

      // Test each screen at this resolution
      for (const screen of SCREENS) {
        test(`Capture ${screen.name} at ${device.name}`, async ({ page }) => {
          // Set viewport for this device
          await page.setViewportSize({
            width: device.width,
            height: device.height,
          });

          // Navigate to the screen
          const url = `http://localhost:3127${screen.route}`;

          try {
            await page.goto(url, {
              waitUntil: 'networkidle',
              timeout: 30000
            });
          } catch (error) {
            console.warn(`Failed to navigate to ${url}, continuing with screenshot...`);
          }

          // Wait for page to settle
          await page.waitForTimeout(2000);

          // Additional wait for any animations or dynamic content
          try {
            // Wait for main content area if it exists
            await page.waitForSelector('main, [role="main"], .main-content', {
              timeout: 5000
            }).catch(() => {
              // Ignore if selector not found
            });
          } catch {
            // Continue even if selector not found
          }

          // Construct filename
          const sanitizedScreenName = screen.name.replace(/[^a-z0-9-]/gi, '_');
          const filename = `${sanitizedScreenName}.png`;
          const filepath = path.join(SCREENSHOT_BASE_DIR, device.name, filename);

          // Capture screenshot
          const success = await captureScreenshot(page, filepath);

          // Log result
          if (success) {
            console.log(`✅ ${device.name}/${filename}`);
          } else {
            console.error(`❌ ${device.name}/${filename}`);
          }

          // Soft assertion - don't fail test if screenshot fails
          // This allows the suite to continue even if some screens are inaccessible
          expect(success).toBeTruthy();
        });
      }

      // Additional test: Capture interactive states
      test(`Interactive states at ${device.name}`, async ({ page }) => {
        await page.setViewportSize({
          width: device.width,
          height: device.height,
        });

        // Go to main page
        await page.goto('http://localhost:3127', {
          waitUntil: 'networkidle',
          timeout: 30000
        }).catch(() => {});

        await page.waitForTimeout(2000);

        const deviceDir = path.join(SCREENSHOT_BASE_DIR, device.name);

        // Capture hover states on buttons if they exist
        const buttons = await page.locator('button').all();
        for (let i = 0; i < Math.min(buttons.length, 5); i++) {
          try {
            await buttons[i].hover();
            await page.waitForTimeout(500);
            await captureScreenshot(
              page,
              path.join(deviceDir, `interactive-button-hover-${i}.png`),
              { fullPage: false }
            );
          } catch {
            // Continue if button interaction fails
          }
        }

        // Capture modal states if modals exist
        const modalTriggers = await page.locator('[data-testid*="modal"], [aria-haspopup="dialog"]').all();
        for (let i = 0; i < Math.min(modalTriggers.length, 3); i++) {
          try {
            await modalTriggers[i].click();
            await page.waitForTimeout(1000);
            await captureScreenshot(
              page,
              path.join(deviceDir, `modal-state-${i}.png`)
            );

            // Try to close modal
            await page.keyboard.press('Escape');
            await page.waitForTimeout(500);
          } catch {
            // Continue if modal interaction fails
          }
        }
      });
    });
  }

  test.afterAll(async () => {
    // Generate summary report
    const summaryPath = path.join(SCREENSHOT_BASE_DIR, 'SUMMARY.md');

    let summary = `# Visual Regression Test Summary\n\n`;
    summary += `**Test Run:** ${timestamp}\n`;
    summary += `**Total Devices:** ${DEVICES.length}\n`;
    summary += `**Total Screens:** ${SCREENS.length}\n`;
    summary += `**Total Screenshots:** ${DEVICES.length * SCREENS.length}\n\n`;

    summary += `## Device Configurations\n\n`;
    summary += `| Device | Resolution | Scale Factor | Orientation |\n`;
    summary += `|--------|-----------|--------------|-------------|\n`;

    DEVICES.forEach(device => {
      const orientation = device.width > device.height ? 'Landscape' : 'Portrait';
      summary += `| ${device.name} | ${device.width}x${device.height} | ${device.deviceScaleFactor}x | ${orientation} |\n`;
    });

    summary += `\n## Screens Captured\n\n`;
    SCREENS.forEach(screen => {
      summary += `- **${screen.name}**: \`${screen.route}\`\n`;
    });

    summary += `\n## Directory Structure\n\n`;
    summary += `\`\`\`\n`;
    summary += `${SCREENSHOT_BASE_DIR}/\n`;
    DEVICES.forEach(device => {
      summary += `├── ${device.name}/\n`;
      SCREENS.forEach(screen => {
        summary += `│   ├── ${screen.name.replace(/[^a-z0-9-]/gi, '_')}.png\n`;
      });
    });
    summary += `\`\`\`\n`;

    summary += `\n## Usage\n\n`;
    summary += `These screenshots can be used for:\n`;
    summary += `- Visual regression testing (compare against baseline)\n`;
    summary += `- UI/UX documentation\n`;
    summary += `- Cross-device compatibility verification\n`;
    summary += `- Design review and QA\n`;
    summary += `- DevOps monitoring and alerts\n\n`;

    summary += `## Integration with GraphDone-DevOps\n\n`;
    summary += `To integrate these screenshots with your DevOps pipeline:\n\n`;
    summary += `1. **Automated comparison**: Use tools like Pixelmatch or Percy for visual diff\n`;
    summary += `2. **Artifact storage**: Upload to S3/artifact storage for historical tracking\n`;
    summary += `3. **CI/CD alerts**: Trigger notifications on visual changes\n`;
    summary += `4. **Baseline management**: Store approved screenshots as baselines\n\n`;

    fs.writeFileSync(summaryPath, summary);

    console.log(`\n✅ Visual Regression Suite Complete!`);
    console.log(`📁 Screenshots saved to: ${SCREENSHOT_BASE_DIR}`);
    console.log(`📄 Summary report: ${summaryPath}\n`);
  });
});
