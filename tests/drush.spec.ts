import { readFileSync } from 'node:fs';
import { expect, test, type Page } from './test';
import { gotoSettled } from './settle';

/**
 * The Drush easter egg (src/scripts/drush.ts): a typed sequence, never one key
 * (SC 2.1.4); a polite status line (SC 4.1.3); the footer dialog works by
 * keyboard and returns focus; motion ends within a second and stops under
 * reduced motion (SC 2.3.3).
 */

const ROUTE = '/';
const SETTLE_MS = 1_500;
const STATUS = 'Cache cleared. Kindness rebuilt.';

/* Bricks on screen, so the cache clear has something to move. */
const typeAnywhere = async (page: import('./test').Page, text: string) => {
  await page.locator('main .card-block').first().scrollIntoViewIfNeeded();
  await page.mouse.click(2, 2);
  await page.keyboard.type(text);
};

test('typing drush cr announces the cache clear and the bricks land within a second', async ({
  page,
}) => {
  await gotoSettled(page, ROUTE);
  await typeAnywhere(page, 'drush cr');
  await expect(
    page.getByRole('status').filter({ hasText: STATUS }),
  ).toBeAttached();
  expect(
    await page.evaluate(
      () =>
        document.getAnimations().filter((a) => a.constructor === Animation)
          .length,
    ),
    'the cache clear moved nothing',
  ).toBeGreaterThan(0);
  await page.waitForTimeout(SETTLE_MS);
  expect(
    await page.evaluate(
      () =>
        document.getAnimations().filter((a) => a.playState === 'running')
          .length,
    ),
    'a brick still moves after the cache clear',
  ).toBe(0);
});

test('one key, or the command typed in a field, does nothing', async ({
  page,
}) => {
  await gotoSettled(page, '/contact');
  await typeAnywhere(page, 'r');
  await page.getByRole('textbox').first().fill('');
  await page.getByRole('textbox').first().pressSequentially('drush cr');
  await expect(
    page.getByRole('status').filter({ hasText: STATUS }),
  ).toHaveCount(0);
  await expect(page.getByRole('dialog', { name: 'Drush' })).toBeHidden();
});

test('under reduced motion drush cr only announces', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await gotoSettled(page, ROUTE);
  await typeAnywhere(page, 'drush cr');
  await expect(
    page.getByRole('status').filter({ hasText: STATUS }),
  ).toBeAttached();
  expect(
    await page.evaluate(
      () =>
        document
          .getAnimations()
          .filter(
            (a) =>
              !(a instanceof CSSAnimation || a instanceof CSSTransition) &&
              (a.effect as KeyframeEffect | null)?.target?.closest('main'),
          ).length,
    ),
    'a brick moved under reduced motion',
  ).toBe(0);
});

test('Try a Command opens the dialog by keyboard, runs a pick and returns focus', async ({
  page,
}) => {
  await gotoSettled(page, ROUTE);
  const trigger = page.getByRole('button', { name: 'Try a Command' });
  await trigger.focus();
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog', { name: 'Drush' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('textbox', { name: 'Command' })).toBeFocused();
  await dialog.getByRole('button', { name: 'drush status' }).click();
  await expect(dialog.getByRole('status')).toContainText('Kindness: Enabled');
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
});

test('typing a command in the dialog runs it, and an unknown one says what to try', async ({
  page,
}) => {
  await gotoSettled(page, ROUTE);
  await page.getByRole('button', { name: 'Try a Command' }).click();
  const input = page.getByRole('textbox', { name: 'Command' });
  await input.fill('drush uli');
  await input.press('Enter');
  const output = page
    .getByRole('dialog', { name: 'Drush' })
    .getByRole('status');
  await expect(output).toContainText('Friend');
  await input.fill('drush sql-drop');
  await input.press('Enter');
  await expect(output).toContainText('Try drush cr');
});

test('typing drush status anywhere opens the dialog with its output', async ({
  page,
}) => {
  await gotoSettled(page, ROUTE);
  await typeAnywhere(page, 'drush status');
  const dialog = page.getByRole('dialog', { name: 'Drush' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('status')).toContainText('Cats: 3');
});

/* WebKit applies upgrade-insecure-requests on loopback and then loads nothing over http. */
const UPGRADE_INSECURE = /;?\s*upgrade-insecure-requests/;

/* Serves `path` with the CSP the site ships (Trusted Types included) and collects what it blocks. */
const withShippedCsp = async (page: Page, path: string) => {
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
  await page.route(`**${path}`, async (route) => {
    const response = await route.fetch();
    await route.fulfill({
      response,
      headers: {
        ...response.headers(),
        'content-security-policy': csp!.replace(UPGRADE_INSECURE, ''),
      },
    });
  });
  return errors;
};

test('the commands run under the CSP the site ships (Trusted Types)', async ({
  page,
}) => {
  const errors = await withShippedCsp(page, '/');
  await gotoSettled(page, ROUTE);
  await typeAnywhere(page, 'drush cr');
  await expect(
    page.getByRole('status').filter({ hasText: STATUS }),
  ).toBeAttached();
  await page.getByRole('button', { name: 'Try a Command' }).click();
  await expect(page.getByRole('dialog', { name: 'Drush' })).toBeVisible();
  expect(errors, 'the shipped CSP blocked or broke the easter egg').toEqual([]);
});
