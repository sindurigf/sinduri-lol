import { expect, test, type Page } from './test';
import { gotoSettled } from './settle';

/**
 * The toy footer (src/scripts/toy.ts): play mode by keyboard as well as by
 * pointer (SC 2.1.1, 2.5.7), stickers stay in their play area and never over
 * text, the mode is announced (SC 4.1.3), reduced motion drops the toss
 * (SC 2.3.3), and Stop Playing gives the links back.
 */

const ROUTE = '/';
const SETTLE_MS = 1_200;

const start = async (page: Page) => {
  await gotoSettled(page, ROUTE);
  const toggle = page.getByRole('button', { name: 'Play With the Stickers' });
  await toggle.scrollIntoViewIfNeeded();
  await toggle.click();
  await expect(
    page.getByRole('button', { name: 'Stop Playing' }),
  ).toBeVisible();
  return page.getByRole('navigation', { name: 'Social' }).getByRole('link');
};

const offset = (page: Page, index: number) =>
  page.evaluate(
    (i) =>
      getComputedStyle(document.querySelectorAll('.footer-stickers > li')[i]!)
        .translate,
    index,
  );

/* Every sticker inside the list and tray, and over no text in the footer. */
const stickersStayPut = (page: Page) =>
  page.evaluate(() => {
    const area = document
      .querySelector('.footer-stickers')!
      .getBoundingClientRect();
    const tray = document.querySelector('.toy-tray')!.getBoundingClientRect();
    const texts: DOMRect[] = [];
    const walker = document.createTreeWalker(
      document.querySelector('footer')!,
      NodeFilter.SHOW_TEXT,
    );
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (
        !node.textContent?.trim() ||
        node.parentElement?.closest('.sr-only, .footer-stickers, button')
      )
        continue;
      const range = document.createRange();
      range.selectNodeContents(node);
      texts.push(...range.getClientRects());
    }
    return [
      ...document.querySelectorAll<HTMLAnchorElement>('.footer-sticker'),
    ].flatMap((sticker) => {
      const box = sticker.getBoundingClientRect();
      /* A tilted sticker's box reaches a few px past the list at home. */
      const slack = 4;
      const inside =
        box.left >= Math.min(area.left, tray.left) - slack &&
        box.right <= Math.max(area.right, tray.right) + slack &&
        box.top >= area.top - slack &&
        box.bottom <= tray.bottom + slack;
      const clear = texts.every(
        (t) =>
          box.right <= t.left ||
          t.right <= box.left ||
          box.bottom <= t.top ||
          t.bottom <= box.top,
      );
      const where = [box.left, box.top, box.right, box.bottom]
        .map(Math.round)
        .join(',');
      return [
        ...(inside ? [] : [`${sticker.href} outside its area at ${where}`]),
        ...(clear ? [] : [`${sticker.href} over text at ${where}`]),
      ];
    });
  });

test('play mode works from the keyboard, stays in its area and is announced', async ({
  page,
}) => {
  const links = await start(page);
  await expect(page.locator('footer').getByRole('status')).toContainText(
    'Play mode on',
  );
  const before = await offset(page, 0);
  await links.first().focus();
  for (let i = 0; i < 30; i += 1) await page.keyboard.press('Shift+ArrowDown');
  for (let i = 0; i < 30; i += 1) await page.keyboard.press('Shift+ArrowRight');
  expect(await offset(page, 0), 'the arrow keys moved nothing').not.toBe(
    before,
  );
  expect(await stickersStayPut(page)).toEqual([]);
  const url = page.url();
  await page.keyboard.press('Enter');
  await links.first().click();
  expect(page.url(), 'a sticker followed its link in play mode').toBe(url);
});

test('a dragged and tossed sticker lands inside its area', async ({ page }) => {
  const links = await start(page);
  const box = (await links.nth(2).boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + 400, box.y + 600, { steps: 4 });
  await page.mouse.up();
  await page.waitForTimeout(SETTLE_MS);
  expect(await offset(page, 2)).not.toBe('none');
  expect(await stickersStayPut(page)).toEqual([]);
});

test('under reduced motion a dropped sticker is not tossed', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const links = await start(page);
  const box = (await links.nth(1).boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + 60, box.y + 80, { steps: 2 });
  await page.mouse.up();
  /* Pointer moves land a frame late; read once they have. */
  await page.waitForTimeout(SETTLE_MS / 4);
  const dropped = await offset(page, 1);
  await page.waitForTimeout(SETTLE_MS);
  expect(await offset(page, 1)).toBe(dropped);
});

test('Put Them Back and Stop Playing return the stickers and their links', async ({
  page,
}) => {
  const links = await start(page);
  await links.first().focus();
  await page.keyboard.press('ArrowDown');
  await page.getByRole('button', { name: 'Put Them Back' }).click();
  expect(await offset(page, 0)).toMatch(/^(none|0px( 0px)?)$/);
  await page.keyboard.press('ArrowDown');
  await page.getByRole('button', { name: 'Stop Playing' }).click();
  await expect(page.locator('footer')).not.toHaveAttribute('data-toy');
  await expect(page.getByRole('button', { name: 'Put Them Back' })).toHaveCount(
    0,
  );
  expect(await offset(page, 0)).toMatch(/^(none|0px( 0px)?)$/);
});

test('without JavaScript there is no toy button', async ({
  browser,
  baseURL,
}) => {
  const context = await browser.newContext({
    baseURL,
    javaScriptEnabled: false,
  });
  const page = await context.newPage();
  await page.goto(ROUTE);
  await expect(
    page.getByRole('button', { name: 'Play With the Stickers' }),
  ).toBeHidden();
  await context.close();
});
