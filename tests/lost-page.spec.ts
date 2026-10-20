import { expect, test } from './test';
import { gotoSettled } from './settle';
import { MIN_TARGET } from './wcag';

/**
 * The 404 game (src/scripts/lost-page.ts): turn-based, so it plays by keyboard
 * and screen reader (SC 2.1.1, 4.1.3); its bricks are 44px targets (SC 2.5.5);
 * reduced motion drops the lift (SC 2.3.3); without script it is not offered.
 */

const ROUTE = '/404';
const BRICKS = 5;

const playToTheEnd = async (page: import('./test').Page) => {
  const status = page.locator('[data-lost-game]').getByRole('status');
  for (let n = 1; n <= BRICKS; n += 1) {
    const brick = page.getByRole('button', { name: `Look behind brick ${n}` });
    await brick.focus();
    await page.keyboard.press('Enter');
    if ((await status.textContent())?.includes('Found it')) return n;
    await expect(status).toContainText(`Not behind brick ${n}`);
    await expect(
      page.getByRole('button', { name: `Brick ${n}, nothing here` }),
    ).toHaveAttribute('aria-disabled', 'true');
  }
  throw new Error('the page was behind no brick');
};

test('the game plays by keyboard to the end, with every turn announced', async ({
  page,
}) => {
  await gotoSettled(page, ROUTE);
  await expect(
    page.getByRole('heading', { name: 'Help Find This Page' }),
  ).toBeVisible();
  for (let n = 1; n <= BRICKS; n += 1) {
    const box = await page
      .getByRole('button', { name: `Look behind brick ${n}` })
      .boundingBox();
    expect(Math.min(box!.width, box!.height)).toBeGreaterThanOrEqual(
      MIN_TARGET,
    );
  }
  const found = await playToTheEnd(page);
  await expect(
    page.locator('[data-lost-game]').getByRole('status'),
  ).toContainText(`behind brick ${found}`);
  const art = page.locator('.lost-brick[data-found] svg');
  expect(
    await art.evaluate((svg) => {
      const box = (svg as SVGSVGElement).getBBox();
      return box.width > 0 && box.height > 0;
    }),
    'the found brick shows no rabbit',
  ).toBe(true);

  const again = page.getByRole('button', { name: 'Play Again' });
  await again.focus();
  await page.keyboard.press('Enter');
  await expect(
    page.getByRole('button', { name: 'Look behind brick 1' }),
  ).toBeFocused();
  await expect(again).toBeHidden();
});

test('under reduced motion a looked-at brick does not move', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await gotoSettled(page, ROUTE);
  await page.getByRole('button', { name: 'Look behind brick 1' }).click();
  expect(
    await page
      .locator('.lost-brick[data-looked]')
      .evaluate((brick) => getComputedStyle(brick).animationName),
  ).toBe('none');
});

test('without JavaScript the game is not offered', async ({
  browser,
  baseURL,
}) => {
  const context = await browser.newContext({
    baseURL,
    javaScriptEnabled: false,
  });
  const page = await context.newPage();
  await page.goto(ROUTE);
  await expect(page.locator('[data-lost-game]')).toBeHidden();
  await context.close();
});
