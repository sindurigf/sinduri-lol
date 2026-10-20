import { expect, test, type Page } from './test';
import { gotoSettled } from './settle';

/**
 * The Drush easter egg (src/scripts/drush.ts), loaded on demand: a typed
 * word, never one key, and a way to turn it off (SC 2.1.4); a polite output
 * (SC 4.1.3); the dialog works by keyboard and returns focus; the cache clear
 * ends on its own and does not move under reduced motion (SC 2.3.3).
 */

const ROUTE = '/';
const CLEARED = 'Cache cleared. Kindness rebuilt.';
/* SC 2.2.2 needs no pause control for motion under five seconds. */
const MOTION_MAX_MS = 5_000;

/* Bricks on screen, so the cache clear has something to move. */
const typeAnywhere = async (page: Page, text: string) => {
  await page.locator('main .card-block').first().scrollIntoViewIfNeeded();
  await page.mouse.click(2, 2);
  await page.keyboard.type(text);
};

const dialogOf = (page: Page) => page.getByRole('dialog', { name: 'Drush' });

test('typing drush opens the dialog ready for the rest of the command', async ({
  page,
}) => {
  await gotoSettled(page, ROUTE);
  await typeAnywhere(page, 'drush');
  const command = dialogOf(page).getByRole('textbox', { name: 'Command' });
  await expect(command).toBeFocused();
  await page.keyboard.type('cr');
  await page.keyboard.press('Enter');
  await expect(dialogOf(page).getByRole('status')).toHaveText(CLEARED);
  const durations = await page.evaluate(() =>
    document
      .getAnimations()
      .filter((a) => a.constructor === Animation)
      .map((a) => Number(a.effect?.getComputedTiming().endTime)),
  );
  expect(durations.length, 'the cache clear moved nothing').toBeGreaterThan(0);
  expect(
    durations.filter((ms) => !(ms < MOTION_MAX_MS)),
    'a brick moves for five seconds or more',
  ).toEqual([]);
});

test('one key, the word typed in a field, or with Ctrl does nothing', async ({
  page,
}) => {
  await gotoSettled(page, '/contact');
  await typeAnywhere(page, 'd');
  await page.keyboard.down('Control');
  await page.keyboard.type('drush');
  await page.keyboard.up('Control');
  await page.getByRole('textbox').first().pressSequentially('drush');
  await expect(dialogOf(page)).toBeHidden();
});

test('under reduced motion drush cr only answers', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await gotoSettled(page, ROUTE);
  await typeAnywhere(page, 'drush');
  await expect(
    dialogOf(page).getByRole('textbox', { name: 'Command' }),
  ).toBeFocused();
  await page.keyboard.type('cr');
  await page.keyboard.press('Enter');
  await expect(dialogOf(page).getByRole('status')).toHaveText(CLEARED);
  expect(
    await page.evaluate(
      () =>
        document
          .getAnimations()
          .filter(
            (a) =>
              a.constructor === Animation &&
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
  const dialog = dialogOf(page);
  await expect(dialog.getByRole('textbox', { name: 'Command' })).toBeFocused();
  await dialog.getByRole('button', { name: 'drush status' }).click();
  await expect(dialog.getByRole('status')).toContainText('Kindness: Enabled');
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
});

test('an unknown command says what to try', async ({ page }) => {
  await gotoSettled(page, ROUTE);
  await page.getByRole('button', { name: 'Try a Command' }).click();
  const input = page.getByRole('textbox', { name: 'Command' });
  await input.fill('drush sql-drop');
  await input.press('Enter');
  await expect(dialogOf(page).getByRole('status')).toContainText(
    'Try drush cr',
  );
});

test('the typed word can be turned off, and stays off on the next page', async ({
  page,
}) => {
  await gotoSettled(page, ROUTE);
  await page.getByRole('button', { name: 'Try a Command' }).click();
  const off = dialogOf(page).getByRole('button', {
    name: 'Open When I Type drush',
  });
  await expect(off).toHaveAttribute('aria-pressed', 'true');
  await off.click();
  await expect(off).toHaveAttribute('aria-pressed', 'false');
  await page.keyboard.press('Escape');

  await gotoSettled(page, '/about');
  await page.mouse.click(2, 2);
  await page.keyboard.type('drush');
  await expect(dialogOf(page)).toBeHidden();
  await page.getByRole('button', { name: 'Try a Command' }).click();
  await expect(dialogOf(page)).toBeVisible();
});
