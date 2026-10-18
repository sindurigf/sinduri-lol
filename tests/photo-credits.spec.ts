import { expect, test } from './test';
import { gotoSettled } from './settle';
import { LICENSED_PHOTOS } from '../src/lib/credits';

/**
 * A Creative Commons photo shown outside /credits carries its license link
 * (CC BY 2.0 §4(a)), its short name expanded (SC 3.1.4).
 */
/* /brand shows each example twice; the light copy is inert. */
const live = (selector: string) => `main ${selector}:not([inert] *)`;

const SHOWN: readonly {
  route: string;
  photo: keyof typeof LICENSED_PHOTOS;
  /** About credits a whole strip of photos in one line. */
  prefix: string;
}[] = [
  { route: '/brand/photos', photo: 'drupal-lecture-hall', prefix: 'Photo: ' },
  {
    route: '/blog/open-source-is-not-just-code',
    photo: 'drupal-lecture-hall',
    prefix: 'Photo: ',
  },
  { route: '/about', photo: 'drupalcon-rotterdam-award', prefix: 'Photos: ' },
];

test.describe('a Creative Commons photo caption outside /credits', () => {
  for (const { route, photo, prefix } of SHOWN) {
    const { photographer, source, license, licenseShort, licenseHref } =
      LICENSED_PHOTOS[photo];

    test(`${route} credits ${photo} with its source and license links`, async ({
      page,
    }) => {
      await gotoSettled(page, route);
      const name = page.locator(live(`a[href="${source}"]`));
      await expect(name, `${photographer} does not link the photo`).toHaveText(
        photographer,
      );

      const caption = name.locator(
        'xpath=ancestor::*[self::figcaption or self::p][1]',
      );
      await expect(
        caption,
        `the credit does not open with "${prefix}"`,
      ).toHaveText(new RegExp(`^${RegExp.escape(prefix)}`));

      const licenseLink = caption.locator(`a[href="${licenseHref}"]`);
      await expect(
        licenseLink,
        `the caption has no ${licenseShort} link to the license`,
      ).toHaveAccessibleName(licenseShort);
      await expect(
        licenseLink,
        `${licenseShort} is not described by "${license}" (SC 3.1.4)`,
      ).toHaveAccessibleDescription(license);
    });
  }

  test('focus on the short license shows its expansion', async ({ page }) => {
    const { licenseHref, license } = LICENSED_PHOTOS['drupal-lecture-hall'];
    await gotoSettled(page, '/brand/photos');
    await expect(
      page.locator('[data-abbr]:not([data-abbr-ready])'),
      'an abbreviation was never enhanced, so its script did not run.',
    ).toHaveCount(0);
    const link = page.locator(live(`a[href="${licenseHref}"]`));
    const tip = link.locator('xpath=..').locator('.abbr-tip');
    await link.focus();
    await expect(tip, 'focus does not show the expansion.').toHaveText(license);
    await expect(tip, 'focus does not show the expansion.').toBeVisible();
  });
});
