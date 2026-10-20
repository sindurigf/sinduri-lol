import { readFileSync } from 'node:fs';
import { expect, test } from './test';
import { gotoSettled } from './settle';

/**
 * The 404 finder (src/scripts/lost-page.ts): a mistyped address leads to the
 * real page, best match first (function); every find is announced (SC 4.1.3);
 * the quick links are there from the start and without script (SC 2.1.1);
 * reduced motion keeps the rabbit still (SC 2.3.3); it runs under the CSP the
 * site ships.
 */

const TYPO = '/blgo/';
/* WebKit applies upgrade-insecure-requests on loopback and then loads nothing over http. */
const UPGRADE_INSECURE = /;?\s*upgrade-insecure-requests/;
const SNIFFS_MAX = 5;

test('a mistyped address is sniffed out to the real page, best match first', async ({
  page,
}) => {
  await gotoSettled(page, TYPO);
  const sniff = page.locator('[data-lost-sniff]');
  await sniff.click();
  const finds = page.locator('[data-lost-finds] li');
  await expect(finds.first().getByRole('link')).toHaveAttribute(
    'href',
    '/blog/',
  );
  await expect(page.locator('.lost-status')).toContainText(
    'Found a trail: Blog',
  );
  for (let i = 0; i < SNIFFS_MAX && (await sniff.isVisible()); i += 1) {
    await sniff.click();
  }
  await expect(sniff, 'Sniff Around never finished').toBeHidden();
  await expect(
    page.locator('[data-lost-finds] [data-found] a').last(),
    'focus fell to the page when Sniff Around went away',
  ).toBeFocused();
  await expect(
    page.locator('[data-lost-finds]').getByRole('link', { name: 'Blog' }),
    'a find shows twice',
  ).toHaveCount(1);
  await expect(
    page.locator('[data-lost-finds]').getByRole('link', { name: 'Home' }),
  ).toBeVisible();
});

test('a mistyped post address finds the post', async ({ page }) => {
  await gotoSettled(page, '/blog/five-years-drupal/');
  await page.locator('[data-lost-sniff]').click();
  await expect(
    page.locator('[data-lost-finds] li').first().getByRole('link'),
  ).toHaveAttribute('href', '/blog/five-years-in-drupal/');
});

test('without JavaScript the quick links stand alone', async ({
  browser,
  baseURL,
}) => {
  const context = await browser.newContext({
    baseURL,
    javaScriptEnabled: false,
  });
  const page = await context.newPage();
  await page.goto(TYPO);
  await expect(page.locator('[data-lost-sniff]')).toBeHidden();
  await expect(page.getByText('The rabbit can sniff')).toBeHidden();
  await expect(page.locator('[data-lost-finds]').getByRole('link')).toHaveCount(
    2,
  );
  await context.close();
});

test('under reduced motion the rabbit does not move', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await gotoSettled(page, TYPO);
  await page.locator('[data-lost-sniff]').click();
  expect(
    await page
      .locator('.lost-rabbit')
      .evaluate((art) => getComputedStyle(art).animationName),
  ).toBe('none');
});

test('the finder runs under the CSP the site ships (Trusted Types)', async ({
  page,
}) => {
  const csp = /Content-Security-Policy: (.+)/.exec(
    readFileSync('public/_headers', 'utf8'),
  )?.[1];
  expect(csp, 'public/_headers has no Content-Security-Policy').toBeTruthy();
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.addInitScript(() => {
    document.addEventListener('securitypolicyviolation', (event) =>
      console.error(`csp: ${event.violatedDirective}`),
    );
  });
  page.on('console', (message) => {
    if (message.text().startsWith('csp:')) errors.push(message.text());
  });
  await page.route(`**${TYPO}`, async (route) => {
    const response = await route.fetch();
    await route.fulfill({
      response,
      headers: {
        ...response.headers(),
        'content-security-policy': csp!.replace(UPGRADE_INSECURE, ''),
      },
    });
  });
  await gotoSettled(page, TYPO);
  await page.locator('[data-lost-sniff]').click();
  await expect(page.locator('[data-lost-finds] [data-found]')).toHaveCount(1);
  expect(errors, 'the shipped CSP blocked or broke the finder').toEqual([]);
});
