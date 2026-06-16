import { test, expect, Page } from '@playwright/test';
import { login, TEST_USERS } from '../helpers/auth';

/**
 * Mobile usability of the non-graph views. On a phone a user should be able to
 * READ and EXPLORE each view by scrolling DOWN — never by scrolling sideways to
 * reach content. These tests reproduce the "the other views don't work on mobile"
 * experience: any view whose content needs horizontal scrolling (a wide table,
 * a row of board columns, a timeline) fails here until it gets a phone layout.
 */
test.use({ viewport: { width: 390, height: 844 } });

const VIEWS = [
  { name: 'Dashboard', tab: 'Dashboard View' },
  { name: 'Table', tab: 'Table View' },
  { name: 'Card', tab: 'Card View' },
  { name: 'Kanban', tab: 'Kanban View' },
  { name: 'Gantt', tab: 'Gantt Chart' },
  { name: 'Calendar', tab: 'Calendar View' },
  { name: 'Activity', tab: 'Activity Feed' },
];

async function openView(page: Page, tab: string) {
  const t = page.locator(`button[title="${tab}"]`);
  await t.scrollIntoViewIfNeeded();
  await t.click();
  await page.waitForTimeout(2000);
}

test.describe('mobile views are explorable by scrolling down, not sideways @mobile', () => {
  for (const v of VIEWS) {
    test(`${v.name} view needs no horizontal scrolling on a phone`, async ({ page }) => {
      const pageErrors: string[] = [];
      page.on('pageerror', (e) => pageErrors.push(e.message));

      await login(page, TEST_USERS.ADMIN);
      await openView(page, v.tab);

      const probe = await page.evaluate(() => {
        const el = document.querySelector('[data-testid="view-content"]');
        if (!el) return { found: false, offenders: [] as any[], docOverflow: 0 };
        // Any element whose content is wider than its box is something the user
        // must scroll sideways to see — the failure we hunt for.
        const offenders: { tag: string; cls: string; scrollW: number; clientW: number }[] = [];
        el.querySelectorAll('*').forEach((d) => {
          const e = d as HTMLElement;
          const ox = getComputedStyle(e).overflowX;
          // Only horizontally-scrollable boxes count: those force the user to
          // swipe sideways. (Plain `truncate` text clips with an ellipsis and is
          // fine.)
          const scrollable = ox === 'auto' || ox === 'scroll';
          if (scrollable && e.clientWidth > 0 && e.scrollWidth > e.clientWidth + 16) {
            offenders.push({
              tag: e.tagName,
              cls: (e.className?.toString?.() || '').slice(0, 48),
              scrollW: e.scrollWidth,
              clientW: e.clientWidth,
            });
          }
        });
        return {
          found: true,
          offenders: offenders.slice(0, 6),
          docOverflow: document.documentElement.scrollWidth - window.innerWidth,
        };
      });

      expect(probe.found, 'view content container present').toBe(true);
      expect(probe.docOverflow, 'page itself must not overflow sideways').toBeLessThanOrEqual(1);
      expect(
        probe.offenders,
        `${v.name}: these elements force horizontal scrolling on a phone`
      ).toEqual([]);
      expect(pageErrors, `${v.name}: no uncaught JS errors`).toEqual([]);
    });
  }

  test('Calendar defaults to the agenda list on a phone (not the cramped month grid)', async ({ page }) => {
    await login(page, TEST_USERS.ADMIN);
    await openView(page, 'Calendar View');
    const agendaActive = await page.evaluate(() => {
      const btn = [...document.querySelectorAll('button')].find(
        (b) => (b.textContent || '').trim() === 'Agenda'
      );
      return !!btn && /bg-green/.test(btn.className);
    });
    expect(agendaActive, 'Calendar should land on Agenda on a phone').toBe(true);
  });
});
