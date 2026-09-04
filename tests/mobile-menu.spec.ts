import { expect, test } from '@playwright/test';

/**
 * 320px is the WCAG 2.2 SC 1.4.10 Reflow width: 1280px at 400% zoom. A desktop
 * user magnifying the page lands here, so the mobile menu is their only
 * navigation. It has to open, take focus, and give focus back on Escape.
 */
const REFLOW_VIEWPORT = { width: 320, height: 720 };

test.describe('mobile menu at 320px', () => {
  test.use({ viewport: REFLOW_VIEWPORT });

  test('opens, takes focus, and closes on Escape', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });

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
    await page.goto('/', { waitUntil: 'networkidle' });

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
