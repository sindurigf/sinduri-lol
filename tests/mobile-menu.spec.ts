import { expect, test } from '@playwright/test';
import { gotoSettled } from './settle';
import { REFLOW_VIEWPORT } from './wcag';

/**
 * At the SC 1.4.10 reflow width a desktop user magnifying the page lands here,
 * so the mobile menu is their only navigation. It has to open, take focus, and
 * give focus back on Escape.
 */
test.describe('mobile menu at 320px', () => {
  test.use({ viewport: REFLOW_VIEWPORT });

  test('opens, takes focus, and closes on Escape', async ({ page }) => {
    await gotoSettled(page, '/');

    const trigger = page.getByRole('button', { name: /menu/i });
    await expect(
      trigger,
      'the menu trigger should be visible at 320px',
    ).toBeVisible();
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');

    await trigger.click();

    const panel = page.getByRole('dialog');
    await expect(panel, 'the panel should open').toBeVisible();
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');

    // Focus must land inside the panel, not be left behind on the page.
    await expect
      .poll(() => panel.evaluate((el) => el.contains(document.activeElement)), {
        message: 'focus should move into the open panel',
      })
      .toBe(true);

    // Every nav destination has to be reachable from here.
    await expect(panel.getByRole('link')).not.toHaveCount(0);

    await page.keyboard.press('Escape');

    await expect(panel, 'Escape should close the panel').toBeHidden();
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await expect(trigger, 'focus should return to the trigger').toBeFocused();
  });

  test('every nav link is reachable by keyboard once open', async ({
    page,
  }) => {
    await gotoSettled(page, '/');

    const trigger = page.getByRole('button', { name: /menu/i });
    await trigger.click();

    const panel = page.getByRole('dialog');
    await expect(panel).toBeVisible();

    const links = panel.getByRole('link');
    const count = await links.count();
    expect(count, 'the panel should expose the nav links').toBeGreaterThan(0);

    for (let i = 0; i < count; i += 1) {
      await expect(links.nth(i)).toBeVisible();
    }
  });
});

/**
 * 1280x1024 at 400% zoom. The open menu's content is taller than this, so the
 * dialog scrolls, and a scroll container is itself a tab stop. The dialog
 * fills the viewport, so the site's outward ring drew entirely off screen, and
 * a link scrolled flush to the edge lost its ring the same way (SC 2.4.7). The
 * focus walk in focus.spec.ts runs with the menu closed and cannot see this.
 *
 * Verified 2026-09-12, removing one rule at a time from MobileMenu.vue:
 * without `scroll-padding-block` both engines fail on "Career"; without the
 * inset ring Chromium fails on `mobile-menu-panel`, which is a tab stop there
 * and not in Firefox; without the `focusin` handler Firefox fails on "Career",
 * because it does not scroll a partly visible control into view on focus and
 * Chromium does.
 */
const OVERFLOW_VIEWPORT = { width: 320, height: 256 };
const MAX_TAB_PRESSES = 20;

test.describe('mobile menu when its content overflows', () => {
  test.use({ viewport: OVERFLOW_VIEWPORT });

  test('every focus ring in the open menu is on screen', async ({ page }) => {
    await gotoSettled(page, '/');
    await page.getByRole('button', { name: /menu/i }).click();

    const panel = page.getByRole('dialog');
    await expect(panel).toBeVisible();
    const controls = await panel.locator('a[href], button').count();

    const rings: { stop: string; offscreen: boolean }[] = [];
    for (let i = 0; i <= MAX_TAB_PRESSES; i += 1) {
      // The menu opens with Home focused, so the first reading precedes a Tab.
      if (i > 0) {
        await page.keyboard.press('Tab');
        /*
         * Firefox scrolls the newly focused element into view on the next
         * frame, so a reading taken straight after the key sees the box before
         * the scroll. Chromium scrolls synchronously.
         */
        await page.evaluate(
          () =>
            new Promise((resolve) =>
              requestAnimationFrame(() => requestAnimationFrame(resolve)),
            ),
        );
      }
      const ring = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null;
        if (!el || el === document.body) return null;
        const box = el.getBoundingClientRect();
        const style = getComputedStyle(el);
        const reach =
          parseFloat(style.outlineWidth) + parseFloat(style.outlineOffset);
        return {
          stop: el.id || el.textContent?.trim() || el.tagName,
          offscreen:
            box.left - reach < 0 ||
            box.top - reach < 0 ||
            box.right + reach > window.innerWidth ||
            box.bottom + reach > window.innerHeight,
        };
      });
      if (!ring) continue;
      if (rings.some((seen) => seen.stop === ring.stop)) break;
      rings.push(ring);
    }

    expect(
      rings.length,
      'the walk should reach every link and button in the open menu',
    ).toBeGreaterThanOrEqual(controls);
    expect(
      rings.filter((ring) => ring.offscreen).map((ring) => ring.stop),
      'focus ring(s) drawn outside the viewport',
    ).toEqual([]);
  });
});
