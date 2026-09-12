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
