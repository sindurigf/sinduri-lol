import { expect, test } from './test';
import { gotoSettled } from './settle';

/**
 * Hover states that were written and never drawn. Both lost a cascade fight
 * nobody saw: a colour set by a utility in a later layer, or by an unlayered
 * scoped rule, beat the hover rule, so the control did nothing under the
 * pointer while the stylesheet said otherwise.
 *
 * Proven able to fail, 2026-09-19, chromium: with `text-text` back on the
 * card link in BlogCard.astro, the card test read rgb(229, 226, 225) on
 * hover; with the scoped colour rule back in MobileMenu.vue, the menu test
 * read the same.
 */
const CYAN = 'rgb(0, 220, 253)';

test.describe('hover is drawn', () => {
  test('a linked card turns its title cyan', async ({ page }) => {
    await gotoSettled(page, '/blog/');
    const card = page.locator('article.card:has(.card-link)').first();
    await card.hover();
    await expect(card.locator('.card-link')).toHaveCSS('color', CYAN);
  });

  test('a mobile menu link turns cyan', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await gotoSettled(page, '/');
    await page.getByRole('button', { name: 'Menu' }).click();
    const link = page
      .getByRole('dialog', { name: 'Menu' })
      .getByRole('link', { name: 'Blog' });
    await link.hover();
    await expect(link).toHaveCSS('color', CYAN);
  });

  test('a primary button fills with cyan', async ({ page }) => {
    await gotoSettled(page, '/');
    const button = page.locator('main .btn-primary').first();
    await button.hover();
    await expect(button).toHaveCSS('background-color', CYAN);
  });
});

/**
 * One colour, one job, read from the shadow each thing casts: gold for things
 * that stand on the page, pink for things you press and the bunny marks, cyan
 * for where you are.
 *
 * Proven able to fail, 2026-09-19, chromium: with the current nav item back on
 * the pink shadow in Header.astro, "the current page is cyan" read
 * rgb(255, 0, 122).
 */
const GOLD = 'rgb(255, 192, 0)';
const PINK = 'rgb(255, 0, 122)';

const shadowColour = async (
  locator: import('@playwright/test').Locator,
): Promise<string> =>
  (await locator.evaluate((el) => getComputedStyle(el).boxShadow))
    .match(/rgb\([^)]*\)/g)
    ?.at(-1) ?? 'none';

test.describe('each colour has one job', () => {
  test('things stand on gold, actions and the bunny on pink', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await gotoSettled(page, '/');
    expect(await shadowColour(page.locator('main .card').first())).toBe(GOLD);
    expect(await shadowColour(page.locator('main .btn-primary').first())).toBe(
      PINK,
    );
    expect(
      await shadowColour(page.locator('header a[href="/"] > span').first()),
    ).toBe(PINK);
  });

  test('the current page is cyan', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await gotoSettled(page, '/about/');
    expect(
      await shadowColour(
        page.locator('header nav[aria-label="Primary"] a[aria-current="page"]'),
      ),
    ).toBe(CYAN);
  });
});
