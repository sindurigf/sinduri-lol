import { expect, test } from '@playwright/test';
import { ROUTES } from './routes';
import { gotoSettled } from './settle';

/*
 * Every image is served at about the size it is drawn.
 *
 * Two failures in opposite directions, and the fix for the first creates the
 * second.
 *
 * Oversized: every `<Image>` used to emit the master's own pixels. The bunny
 * mark is 458x900 and is drawn 24 to 56px tall. PageSpeed Insights flagged the
 * homepage roundel on 2026-09-11 as 25.5 KiB wasted of a 25.6 KiB file.
 *
 * Upscaled: the fix passes each call site its drawn height and `DENSITIES`
 * (src/lib/image-densities.ts), which ties a number in the markup to the
 * Tailwind class beside it. Grow the class without the number and the browser
 * stretches a small file, which looks soft and fails nothing else.
 *
 * Measured against each image's layout box, `offsetWidth` and `offsetHeight`,
 * not its bounding rect: the header tile is rotated and the Contact badge
 * spins, and a rotated bounding rect is larger than the image in it. Lazy
 * images are made eager first, because an image that never loaded has no
 * natural size and would pass by being absent.
 *
 * Proven able to fail, 2026-09-11, chromium. Against the build before the fix,
 * all 25 routes failed the oversize assertion and named five placements, from
 * the header mark "drawn 12x24 from a 458x900 file" down; the career
 * watermark, a 760px file drawn at 700, passed, which is the limit doing its
 * job. With the fix in, the header's `h-6` changed to `h-12` with its number
 * left at 24 failed all 25 routes on both dimensions, "drawn 24x48 from a
 * 12x24 file, so it is being stretched".
 */

/**
 * The largest natural size allowed, per dimension, as a multiple of the drawn
 * size times `devicePixelRatio`. Loose on purpose: it catches a master file
 * served to a thumbnail, a factor of ten or twenty, rather than arguing about
 * the career watermark's 760px file drawn at 700.
 */
const OVERSIZE_LIMIT = 1.5;

/** Integer rounding between a generated file and a fractional layout box. */
const ROUNDING_PX = 1;

const DIMENSIONS = [
  { drawn: 'width', natural: 'naturalWidth' },
  { drawn: 'height', natural: 'naturalHeight' },
] as const;

for (const route of ROUTES) {
  test(`every image on ${route} is served at the size it is drawn`, async ({
    page,
  }) => {
    await gotoSettled(page, route);

    const { ratio, images } = await page.evaluate(async () => {
      const all = [...document.querySelectorAll('img')];
      for (const img of all) img.loading = 'eager';
      await Promise.all(all.map((img) => img.decode()));
      return {
        ratio: window.devicePixelRatio,
        images: all
          .filter((img) => img.offsetWidth > 0 && img.offsetHeight > 0)
          .map((img) => ({
            src: img.currentSrc,
            naturalWidth: img.naturalWidth,
            naturalHeight: img.naturalHeight,
            width: img.offsetWidth,
            height: img.offsetHeight,
          })),
      };
    });

    expect(
      images.length,
      'no image is drawn on this page at all, so every assertion below ' +
        'passes against nothing. The header mark is on every route.',
    ).toBeGreaterThan(0);

    for (const image of images) {
      const where =
        `${image.src} is drawn ${image.width}x${image.height} from a ` +
        `${image.naturalWidth}x${image.naturalHeight} file`;

      for (const { drawn, natural } of DIMENSIONS) {
        expect
          .soft(
            image[natural] + ROUNDING_PX,
            `${where}, so it is being stretched. A Tailwind size class ` +
              'changed without the height passed to <Image> beside it.',
          )
          .toBeGreaterThanOrEqual(image[drawn]);

        expect
          .soft(
            image[natural],
            `${where} at devicePixelRatio ${ratio}, more than ` +
              `${OVERSIZE_LIMIT}x what this screen can show. Pass the drawn ` +
              'height and DENSITIES to <Image>.',
          )
          .toBeLessThanOrEqual(
            image[drawn] * ratio * OVERSIZE_LIMIT + ROUNDING_PX,
          );
      }
    }
  });
}
