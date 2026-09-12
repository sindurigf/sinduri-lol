import { expect, test } from '@playwright/test';
import { ROUTES } from './routes';
import { gotoSettled } from './settle';

/**
 * Every enabled button shows the pointer cursor a link has.
 *
 * Tailwind 4's preflight leaves `<button>` on `cursor: default`, so without the
 * base-layer rule in global.css the contact form's submit button, the menu
 * controls and both pause controls all showed the arrow (2026-09-13). Computed
 * style is read for every button, including ones inside the closed menu dialog,
 * because the cascade applies whether or not the element is on screen.
 *
 * Verified not to be vacuous: with the rule removed, every route fails naming
 * its buttons.
 */
for (const route of ROUTES) {
  test(`${route} gives every enabled button the pointer cursor`, async ({
    page,
  }) => {
    await gotoSettled(page, route);

    const buttons = await page.evaluate(() =>
      [...document.querySelectorAll('button:not(:disabled)')].map((button) => ({
        label:
          button.getAttribute('aria-label') ??
          (button.textContent ?? '').trim().slice(0, 40),
        cursor: getComputedStyle(button).cursor,
      })),
    );

    /*
     * Every route renders the menu trigger, so a route with no buttons at all
     * means the page did not render rather than that there is nothing to check.
     */
    expect(buttons.length, `${route} rendered no buttons`).toBeGreaterThan(0);

    expect(
      buttons.filter((button) => button.cursor !== 'pointer'),
      `${route} has button(s) without the pointer cursor`,
    ).toEqual([]);
  });
}
