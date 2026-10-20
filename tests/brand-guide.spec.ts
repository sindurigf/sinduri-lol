import { expect, test } from './test';
import { gotoSettled } from './settle';
import { BRAND_PATH } from '../src/lib/brand-sections';

test.describe('/brand guide', () => {
  test('the page opens with how to use it, before the first section (SC 3.3.5)', async ({
    page,
  }) => {
    await gotoSettled(page, BRAND_PATH);
    const guide = page.locator('.brand-guide');
    await expect(guide.getByRole('listitem')).toHaveCount(3);
    const before = await page.evaluate(
      () =>
        document
          .querySelector('.brand-guide')!
          .compareDocumentPosition(document.querySelector('#grounds')!) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    );
    expect(before, 'the guide comes after the first section').toBeTruthy();
  });

  test('the hover and pressed samples look like the real states of the button (SC 1.4.1, 1.4.11)', async ({
    page,
  }) => {
    await gotoSettled(page, BRAND_PATH);
    const real = page.locator('#primary-button ~ div a.btn-primary').first();
    await real.scrollIntoViewIfNeeded();
    const look = (loc: typeof real) =>
      loc.evaluate((el) => {
        const s = getComputedStyle(el);
        return {
          background: s.backgroundColor,
          color: s.color,
          shadow: s.boxShadow,
          translate: s.translate,
        };
      });
    const rest = await look(real);
    const box = (await real.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    const hovered = await look(real);
    await page.mouse.down();
    const pressed = await look(real);
    await page.mouse.up();
    const sample = (state: string) =>
      page
        .locator(
          `[data-component="primary-button"] .brand-stage-half.mode-dark .${state}`,
        )
        .first();
    const hoverSample = await look(sample('state-hover'));
    const pressSample = await look(sample('state-pressed'));
    expect(hovered.background, 'hover must change the fill').not.toBe(
      rest.background,
    );
    expect(hoverSample.background).toBe(hovered.background);
    expect(hoverSample.color).toBe(hovered.color);
    expect(pressSample.shadow).toBe(pressed.shadow);
    expect(pressSample.translate).toBe(pressed.translate);
  });
});
