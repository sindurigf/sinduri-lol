import { expect, test } from './test';
import { gotoSettled } from './settle';

/** The two sections about the name, on /about and /credits. */

test('the two name sections link to each other', async ({ page }) => {
  await gotoSettled(page, '/about');
  await expect(page.locator('main a[href*="/credits/#name"]')).toHaveCount(1);
  await gotoSettled(page, '/credits');
  await expect(page.locator('main a[href*="/about/#lepus-ridet"]')).toHaveCount(
    1,
  );
});

/*
 * What a reader copies, not the accessible name. The hidden "Why" is out of flow,
 * so an ordinary space beside it collapses: Chromium copies "WHYLEPUS RIDET".
 */
test('"Why Lepus Ridet" copies with the space after the hidden word', async ({
  page,
}) => {
  await gotoSettled(page, '/about');
  const copied = await page.evaluate(() => {
    const heading = document.getElementById('lepus-ridet-heading')!;
    const range = document.createRange();
    range.selectNodeContents(heading);
    const selection = getSelection()!;
    selection.removeAllRanges();
    selection.addRange(range);
    return selection.toString();
  });
  expect(copied).toMatch(/^why\s+lepus ridet$/i);
});
