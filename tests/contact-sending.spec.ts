import { expect, test } from './test';
import { gotoSettled } from './settle';

/**
 * The contact form while its request is in flight. The POST is answered with
 * 204 by the route below, so the page stays in the sending state.
 *
 * Proven able to fail, 2026-09-19, chromium: without
 * src/scripts/contact-sending.ts the form never set aria-busy; with only the
 * double-submit guard removed, a second press sent a second request.
 */
test('sending blocks a second submit and says so', async ({ page }) => {
  let posts = 0;
  /*
   * 204 No Content: a form navigation that gets one leaves the page where it
   * is, so the document stays in the state the script put it in, exactly as
   * it looks while a real request is still in flight.
   */
  await page.route('**/contact/send/', async (route) => {
    posts += 1;
    await route.fulfill({ status: 204 });
  });

  await page.setViewportSize({ width: 1280, height: 900 });
  await gotoSettled(page, '/contact/');
  await page.getByLabel('Name').fill('Ada Lovelace');
  await page.getByLabel('Email').fill('ada@example.com');
  await page.getByLabel('Message').fill('A message long enough to send.');

  const form = page.locator('form[data-contact-form]');
  const button = form.getByRole('button', { name: /send/i });
  const status = form.getByRole('status');

  /* The region exists, empty, before anything is written to it. */
  await expect(status).toHaveCount(1);
  await expect(status).toHaveText('');

  await button.focus();
  await page.keyboard.press('Enter');

  await expect(form).toHaveAttribute('aria-busy', 'true');
  await expect(button).toHaveAttribute('aria-disabled', 'true');
  await expect(button).toHaveText('Sending');
  await expect(status).toHaveText('Sending your message.');
  /* Still focusable and still in the accessibility tree. */
  await expect(button).toBeFocused();
  await expect(button).not.toHaveAttribute('disabled');

  await page.keyboard.press('Enter');
  await page.waitForTimeout(300);
  expect(posts, 'a second press sent a second request').toBe(1);
});
