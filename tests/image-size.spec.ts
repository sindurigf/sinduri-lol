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

/*
 * Every fluid image's `sizes` is the width it is drawn at.
 *
 * The test above allows a file 1.5x its box, because WIDTHS steps by up to
 * 1.5x and the browser picks the next candidate up from `sizes`. That leaves
 * `sizes` itself unchecked: `100vw` for a photo drawn inside the gutter and a
 * card's padding moves every pick up a step, and still passes. PageSpeed
 * Insights flagged three /about photos for it on 2026-09-15.
 *
 * Measured by resolving the attribute the way a browser does, first matching
 * media condition wins, against the image's layout box at each breakpoint's
 * edges. `loading="lazy"` does not matter here: layout exists before the file.
 *
 * Not `sizes="auto"`, which would make this unnecessary in Chromium: an image
 * that is not lazy, including every lazy one with JavaScript off, resolves
 * `auto, ...` to 100vw there, and /about fetched a 1280px file for a 244px
 * box (2026-09-15).
 *
 * Proven able to fail, 2026-09-15, chromium. Against the values before the
 * fit, `/`, `/about`, `/blog` and `/blog/five-years-in-drupal` failed, from
 * "a post photo at 320px is drawn 288px wide and its sizes resolves to 320px"
 * up; with the fit in, all 17 routes passed.
 */

/** Each Tailwind breakpoint the photos change column at, from both sides. */
const SIZES_VIEWPORTS = [320, 639, 640, 767, 768, 1023, 1024, 1327, 1328, 1600];

/**
 * How far `sizes` may run over the drawn width. The fitted values sit within
 * 1.04; this leaves room for a scrollbar without letting `100vw` back in.
 */
const SIZES_LIMIT = 1.1;

for (const route of ROUTES) {
  test(`every fluid image on ${route} names its drawn width in sizes`, async ({
    page,
  }) => {
    await gotoSettled(page, route);

    for (const width of SIZES_VIEWPORTS) {
      await page.setViewportSize({
        width,
        height: page.viewportSize()!.height,
      });

      const images = await page.evaluate(() => {
        const topLevel = (value: string): string[] => {
          const parts = [''];
          let depth = 0;
          for (const char of value) {
            if (char === '(') depth += 1;
            if (char === ')') depth -= 1;
            if (char === ',' && depth === 0) parts.push('');
            else parts[parts.length - 1] += char;
          }
          return parts.map((part) => part.trim());
        };

        const resolve = (sizes: string): number => {
          const entry = topLevel(sizes).find((candidate) => {
            const media = candidate.match(/^(\([^()]*\))\s+/);
            return media === null || matchMedia(media[1]).matches;
          });
          const probe = document.createElement('div');
          probe.style.width = (entry ?? '100vw').replace(/^\([^()]*\)\s+/, '');
          document.body.append(probe);
          const slot = probe.getBoundingClientRect().width;
          probe.remove();
          return slot;
        };

        return [...document.querySelectorAll('img[sizes]')]
          .filter((img) => img instanceof HTMLImageElement)
          .filter((img) => img.offsetWidth > 0)
          .map((img) => ({
            src: img.getAttribute('src'),
            sizes: img.getAttribute('sizes') ?? '',
            drawn: img.offsetWidth,
            slot: resolve(img.getAttribute('sizes') ?? ''),
          }));
      });

      for (const image of images) {
        const where =
          `${image.src} at ${width}px is drawn ${image.drawn}px wide and its ` +
          `sizes resolves to ${image.slot.toFixed(1)}px (${image.sizes})`;

        expect
          .soft(
            image.slot + ROUNDING_PX,
            `${where}, so the browser picks a file too small and stretches it.`,
          )
          .toBeGreaterThanOrEqual(image.drawn);

        expect
          .soft(
            image.slot,
            `${where}, more than ${SIZES_LIMIT}x, so every screen fetches a ` +
              'larger file than it draws. Fit sizes to the layout again.',
          )
          .toBeLessThanOrEqual(image.drawn * SIZES_LIMIT + ROUNDING_PX);
      }
    }
  });
}
