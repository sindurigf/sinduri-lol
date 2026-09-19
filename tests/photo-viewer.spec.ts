import { expect, test } from '@playwright/test';
import { gotoSettled } from './settle';

/**
 * The photo viewer and the photo strip on /about, PhotoViewer.astro and
 * src/scripts/photo-viewer.ts.
 *
 * Each photo is a link to its full-size file, so it works without
 * JavaScript; with it, the link opens the viewer, a native <dialog>. The
 * browser traps focus in it, Escape closes it, and closing returns focus to
 * the photo that opened it; the script moves between photos.
 *
 * Proven able to fail, 2026-09-19, chromium: with `preventDefault` removed
 * from the click handler, both viewer tests failed because the page
 * navigated to the image file instead. Focus returning needs no script: with
 * a listener that refocused the opener removed, the Escape test still passed
 * in Chromium and Firefox, so the listener was removed too.
 */

const ROUTE = '/about';
const STRIP = '#people-photos';

test.describe('the photo viewer', () => {
  test('a photo opens the viewer on itself, and the arrows move through its group', async ({
    page,
  }) => {
    await gotoSettled(page, ROUTE);
    const links = page.locator(`${STRIP} a[data-photo]`);
    const first = links.first();
    const alt = (await first.locator('img').getAttribute('alt')) ?? '';
    const total = await page.locator('a[data-photo="people"]').count();

    await first.click();
    const viewer = page.locator('#photo-viewer');
    await expect(viewer).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`${ROUTE}/?$`));
    await expect(viewer.locator('[data-viewer-caption]')).toHaveText(alt);

    const count = viewer.locator('[data-viewer-count]');
    const before = await count.textContent();
    expect(before).toMatch(new RegExp(` of ${total}$`));

    await page.keyboard.press('ArrowRight');
    await expect(count).not.toHaveText(before ?? '');
    await viewer.getByRole('button', { name: 'Previous' }).click();
    await expect(count).toHaveText(before ?? '');
  });

  test('Escape closes it and focus returns to the photo that opened it', async ({
    page,
  }) => {
    await gotoSettled(page, ROUTE);
    const first = page.locator(`${STRIP} a[data-photo]`).first();
    await first.focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('#photo-viewer')).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(page.locator('#photo-viewer')).toBeHidden();
    await expect(first).toBeFocused();
  });

  test('every photo link points at an image, so it opens without JavaScript', async ({
    page,
  }) => {
    await gotoSettled(page, ROUTE);
    const hrefs = await page
      .locator('a[data-photo]')
      .evaluateAll((links) =>
        links.map((link) => (link as HTMLAnchorElement).pathname),
      );
    expect(hrefs.length).toBeGreaterThan(0);
    for (const href of hrefs) {
      expect(href, `${href} is not an image file`).toMatch(
        /\.(webp|jpe?g|png|avif)$/,
      );
    }
  });
});

test.describe('the photo strip', () => {
  test('its arrow buttons show with JavaScript and scroll it', async ({
    page,
  }) => {
    await gotoSettled(page, ROUTE);
    const strip = page.locator(STRIP);
    const right = page.getByRole('button', { name: 'Scroll photos right' });
    await expect(right).toBeVisible();

    const start = await strip.evaluate((el) => el.scrollLeft);
    await right.click();
    await expect
      .poll(() => strip.evaluate((el) => el.scrollLeft))
      .toBeGreaterThan(start);
  });

  test('without JavaScript the arrow buttons stay hidden', async ({
    browser,
  }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto(ROUTE);
    await expect(
      page.getByRole('button', { name: 'Scroll photos right' }),
    ).toBeHidden();
    await context.close();
  });
});
