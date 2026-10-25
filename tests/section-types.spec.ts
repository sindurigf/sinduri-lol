import { expect, test } from './test';
import { gotoSettled } from './settle';
import { ENGINE_INVARIANT } from './tags';

/** The two sections about the name, on /about and /credits. */

test(
  'the two name sections link to each other',
  ENGINE_INVARIANT,
  async ({ page }) => {
    await gotoSettled(page, '/about');
    await expect(page.locator('main a[href*="/credits/#name"]')).toHaveCount(1);
    await gotoSettled(page, '/credits');
    await expect(
      page.locator('main a[href*="/about/#lepus-ridet"]'),
    ).toHaveCount(1);
  },
);

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

/* px: a phone at its narrowest, the 1280px desktop at 200% zoom, and the desktop. */
const LEPUS_WIDTHS = [320, 640, 1280] as const;

for (const width of LEPUS_WIDTHS) {
  test(`at ${width}px the Lepus Ridet rabbit covers none of the heading or its caption and stays in its row`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await gotoSettled(page, '/about');
    const overlaps = await page.evaluate(() => {
      const rabbit = document
        .querySelector('.lepus-rabbit')!
        .getBoundingClientRect();
      const heading = document.getElementById('lepus-ridet-heading')!;
      const caption = heading.nextElementSibling!;
      return [heading, caption].flatMap((el) => {
        const range = document.createRange();
        range.selectNodeContents(el);
        return [...range.getClientRects()]
          .filter((r) => r.width > 0)
          .filter(
            (r) =>
              r.left < rabbit.right &&
              rabbit.left < r.right &&
              r.top < rabbit.bottom &&
              rabbit.top < r.bottom,
          )
          .map(() => el.textContent?.trim());
      });
    });
    expect(overlaps, 'the Lepus Ridet rabbit covers its heading text').toEqual(
      [],
    );
    expect(
      await page.evaluate(() => {
        const rabbit = document.querySelector('.lepus-rabbit')!;
        return (
          rabbit.getBoundingClientRect().top >=
          rabbit.closest('.lepus-row')!.getBoundingClientRect().top
        );
      }),
      'the Lepus Ridet rabbit rises past the room its row keeps above the tile',
    ).toBe(true);
  });
}
