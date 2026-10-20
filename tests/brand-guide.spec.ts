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
});
