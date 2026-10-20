import { expect, test } from './test';
import { gotoSettled } from './settle';

const GRIN_CLASS = 'grin';
const HEADER_SWITCH = 'header .theme-switch';
const ANIMATION_END_MS = 6000;

const pick = async (page: import('./test').Page, choice: RegExp) => {
  await page.locator(HEADER_SWITCH).click();
  await page.locator('#theme-menu').getByLabel(choice).click();
};

test.describe('The theme button after a pick', () => {
  test('the moon turns on its side as a grin, the button keeps its name, and the glyph returns', async ({
    page,
  }) => {
    await gotoSettled(page, '/about/');
    const button = page.locator(HEADER_SWITCH);
    await expect(button).toHaveAccessibleName('Theme');
    await pick(page, /^Light$/);
    await expect(button).toHaveClass(new RegExp(GRIN_CLASS));
    const moon = button.locator('.theme-switch-moon');
    await expect(
      moon,
      'the grin is the moon, shown even in light mode',
    ).toBeVisible();
    await expect
      .poll(() => moon.evaluate((el) => getComputedStyle(el).rotate))
      .not.toBe('none');
    await expect(button).toHaveAccessibleName('Theme');
    await expect(button.locator('svg')).toHaveCount(2);
    for (const svg of await button.locator('svg').all()) {
      await expect(svg).toHaveAttribute('aria-hidden', 'true');
    }
    await expect(button).not.toHaveClass(new RegExp(GRIN_CLASS), {
      timeout: ANIMATION_END_MS,
    });
    await expect(button.locator('.theme-switch-sun')).toBeVisible();
  });

  test('under reduced motion a pick leaves the glyph alone', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await gotoSettled(page, '/about/');
    await pick(page, /^Light$/);
    const button = page.locator(HEADER_SWITCH);
    await expect(button).not.toHaveClass(new RegExp(GRIN_CLASS));
    await expect(button.locator('.theme-switch-sun')).toBeVisible();
  });
});
