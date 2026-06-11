import { test, expect, Page } from '@playwright/test';
import { login, TEST_USERS } from '../helpers/auth';

// RESP-5 (docs/USER_STORIES.md): the core flow must work on phone, tablet and
// desktop viewports, with no horizontal scroll and visible primary navigation.
// This matrix is the regression net for the responsive epic — grow it with
// each RESP story, don't shrink it.
const VIEWPORTS = [
  { name: 'iphone-se', width: 375, height: 667 },
  { name: 'iphone-15', width: 393, height: 852 },
  { name: 'ipad', width: 820, height: 1180 },
  { name: 'laptop-1080p', width: 1920, height: 1080 },
  { name: 'desktop-4k', width: 3840, height: 2160 }
] as const;

async function noHorizontalScroll(page: Page): Promise<boolean> {
  return page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
}

for (const vp of VIEWPORTS) {
  test.describe(`viewport: ${vp.name} (${vp.width}x${vp.height})`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    test(`login page renders without horizontal scroll @core`, async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      expect(await noHorizontalScroll(page), 'login page must not scroll horizontally').toBe(true);
      await expect(page.locator('input[type="password"]').first()).toBeVisible();
    });

    test(`workspace renders and graph canvas is visible after login`, async ({ page }) => {
      await login(page, TEST_USERS.ADMIN);
      await page.waitForTimeout(3000);
      expect(await noHorizontalScroll(page), 'workspace must not scroll horizontally').toBe(true);
      const canvas = page.locator('.graph-container svg, .graph-container canvas').first();
      await expect(canvas).toBeVisible({ timeout: 15000 });
    });
  });
}
