import { expect, test } from './test';
import { gotoSettled } from './settle';
import {
  LICENSED_PHOTOS,
  photographerHref,
  type LicensedPhoto,
} from '../src/lib/credits';

/**
 * A Creative Commons photo shown outside /credits carries its license link
 * (CC BY 2.0 §4(a)), named by the short license its deed spells out (G55), and
 * its title where the license asks for it (CC BY 2.0 §4(b)).
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
    const licensed: LicensedPhoto = LICENSED_PHOTOS[photo];
    const { photographer, title, source, licenseShort, licenseHref } = licensed;

    test(`${route} credits ${photo} with its source and license links`, async ({
      page,
    }) => {
      await gotoSettled(page, route);
      const sourceLink = page.locator(live(`a[href="${source}"]`));
      const caption = sourceLink.locator(
        'xpath=ancestor::*[self::figcaption or self::p][1]',
      );
      await expect(
        caption,
        `the credit does not open with "${prefix}"`,
      ).toHaveText(new RegExp(`^${RegExp.escape(prefix)}`));

      if (licensed.titleInCaption) {
        await expect(
          sourceLink,
          `the title "${title}" does not link the photo`,
        ).toHaveText(title);
        await expect(
          caption.locator(`a[href="${photographerHref(photographer)}"]`),
          `${photographer} does not link their own site`,
        ).toHaveText(photographer);
      } else {
        await expect(
          sourceLink,
          `${photographer} does not link the photo`,
        ).toHaveText(photographer);
        await expect(
          caption,
          `the caption names the title "${title}"`,
        ).not.toContainText(title);
      }

      await expect(
        caption.locator(`a[href="${licenseHref}"]`),
        `the caption has no ${licenseShort} link to the license`,
      ).toHaveText(licenseShort);
    });
  }
});
