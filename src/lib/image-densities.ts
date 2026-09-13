/**
 * The pixel densities every sized image on the site is generated at.
 *
 * Each call site passes the height it is drawn at, its Tailwind size class in
 * pixels, together with this list, so the browser fetches a file made for its
 * screen rather than the 458x900 or 760x900 master. Two is the ceiling,
 * matching the pixel-ratio cap in HeroField.vue; a 3x phone takes the 2x
 * file.
 *
 * tests/image-size.spec.ts fails when a class and its number drift apart.
 */
export const DENSITIES = [1, 2];

/**
 * The widths a fluid image is generated at, for an image whose drawn size
 * follows the layout rather than a size class. No step between neighbours is
 * larger than 1.5x, the oversize limit in tests/image-size.spec.ts, so the
 * file the browser picks is never more than that over its box. Astro drops
 * any width larger than the master.
 * Markdown images get the same list through src/plugins/post-figure.mjs.
 */
export const WIDTHS = [320, 480, 640, 960, 1280, 1536];
