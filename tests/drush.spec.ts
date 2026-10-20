import { expect, test, type Page } from './test';
import { gotoSettled } from './settle';
import { timedScan } from './axe';

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
  const keys = dialogOf(page).getByRole('checkbox', {
    name: 'Open This When I Type drush',
  });
  await expect(keys).toBeChecked();
  await keys.uncheck();
  await page.keyboard.press('Escape');

  await gotoSettled(page, '/about');
  await page.mouse.click(2, 2);
  await page.keyboard.type('drush');
  await expect(dialogOf(page)).toBeHidden();
  await page.getByRole('button', { name: 'Try a Command' }).click();
  await expect(keys).not.toBeChecked();
});

for (const width of [390, 1280]) {
  test(`at ${width}px the dialog is modal, padded, inside the viewport and passes axe`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 800 });
    await gotoSettled(page, ROUTE);
    await page.getByRole('button', { name: 'Try a Command' }).click();
    const dialog = dialogOf(page);
    await expect(dialog).toBeVisible();
    const layout = await dialog.evaluate((node) => {
      const box = node.getBoundingClientRect();
      const card = node.firstElementChild!;
      return {
        modal: node.matches(':modal'),
        backdrop: getComputedStyle(node, '::backdrop').backgroundColor,
        /* A point outside the card lands on the dialog's backdrop, not the page. */
        cornerHit: document.elementFromPoint(1, 1) === node,
        padding: parseFloat(getComputedStyle(card).paddingTop),
        inside:
          box.left >= 0 &&
          box.top >= 0 &&
          box.right <= innerWidth &&
          box.bottom <= innerHeight,
        centered: Math.abs(box.left - (innerWidth - box.right)) <= 2,
      };
    });
    expect(layout.modal, 'the dialog opened without showModal()').toBe(true);
    expect(layout.backdrop, 'the dialog has no backdrop').not.toBe(
      'rgba(0, 0, 0, 0)',
    );
    expect(layout.cornerHit, 'the page behind the dialog takes clicks').toBe(
      true,
    );
    expect(layout.padding, 'the dialog card has no padding').toBeGreaterThan(0);
    expect(layout.inside, 'the dialog runs past the viewport').toBe(true);
    expect(layout.centered, 'the dialog is not centered').toBe(true);
    const { violations } = await timedScan(page, 'Drush dialog');
    expect(
      violations.map((v) => `${v.id}: ${v.nodes.length} node(s)`),
      'axe found WCAG 2.2 AA violations with the Drush dialog open',
    ).toEqual([]);
  });
}
