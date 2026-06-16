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

const VIEWS = ['Dashboard', 'Table', 'Card', 'Kanban', 'Gantt', 'Calendar', 'Activity'];

// Navigate via the mobile bottom nav (List/Graph) + More sheet — the top tab
// strip is desktop-only now.
async function openView(page: Page, name: string) {
  const nav = page.getByTestId('mobile-bottom-nav');
  if (name === 'Card') {
    await nav.getByText('List', { exact: true }).click();
  } else if (name === 'Graph') {
    await nav.getByText('Graph', { exact: true }).click();
  } else {
    await nav.getByText('More', { exact: true }).click();
    const sheet = page.getByTestId('mobile-more-sheet');
    const label = name === 'Kanban' ? 'Board' : name;
    await sheet.getByText(label, { exact: true }).click();
  }
  await page.waitForTimeout(2000);
}

test.describe('mobile views are explorable by scrolling down, not sideways @mobile', () => {
  for (const name of VIEWS) {
    test(`${name} view needs no horizontal scrolling on a phone`, async ({ page }) => {
      const pageErrors: string[] = [];
      page.on('pageerror', (e) => pageErrors.push(e.message));

      await login(page, TEST_USERS.ADMIN);
      await openView(page, name);

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
        `${name}: these elements force horizontal scrolling on a phone`
      ).toEqual([]);
      expect(pageErrors, `${name}: no uncaught JS errors`).toEqual([]);
    });
  }

  test('Calendar defaults to the agenda list on a phone (not the cramped month grid)', async ({ page }) => {
    await login(page, TEST_USERS.ADMIN);
    await openView(page, 'Calendar');
    const agendaActive = await page.evaluate(() => {
      const btn = [...document.querySelectorAll('button')].find(
        (b) => (b.textContent || '').trim() === 'Agenda'
      );
      return !!btn && /bg-green/.test(btn.className);
    });
    expect(agendaActive, 'Calendar should land on Agenda on a phone').toBe(true);
  });
});
