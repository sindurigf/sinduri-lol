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
