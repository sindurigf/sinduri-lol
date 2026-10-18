import { expect, test } from './test';
import { gotoSettled } from './settle';
import { LICENSED_PHOTOS } from '../src/lib/credits';

/**
 * A Creative Commons photo shown outside /credits carries its license link
 * (CC BY 2.0 §4(a)), named by the short license its deed spells out (G55).
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
    const { photographer, source, licenseShort, licenseHref } =
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

      await expect(
        caption.locator(`a[href="${licenseHref}"]`),
        `the caption has no ${licenseShort} link to the license`,
      ).toHaveText(licenseShort);
    });
  }
});
