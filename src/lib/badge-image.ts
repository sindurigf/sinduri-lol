import { getImage } from 'astro:assets';
import badgeWhite from '../assets/badge-white.png';
import { DENSITIES } from './image-densities';

/*
 * The spinning badge artwork, optimised once and passed into SpinBadge.vue.
 *
 * WHY THIS MODULE EXISTS. Every other image renders through `<Image>` in an
 * .astro file. This one is inside a Vue island, and `astro:assets` is a
 * build-time Astro API a `.vue` component cannot reach. A plain Vite import
 * there would content-hash the original PNG without converting it, leaving
 * the largest image the site ships as the one that never got optimised.
 *
 * `getImage()` is the programmatic half of `<Image>` and returns what the
 * component would have rendered. Calling it here keeps one place to change
 * the format, and stops a second mount point passing different artwork to the
 * same component.
 *
 * The top-level `await` resolves at build time. Nothing here reaches the
 * browser.
 */

/**
 * The badge's drawn width on Contact, `w-40` there, in pixels. Generated at
 * that width and at 2x rather than from the 760x900 master; see
 * src/lib/image-densities.ts.
 */
const BADGE_WIDTH = 160;

const optimised = await getImage({
  src: badgeWhite,
  format: 'webp',
  width: BADGE_WIDTH,
  densities: DENSITIES,
});

/**
 * The shape SpinBadge.vue takes: enough to render an `<img>` that reserves its
 * own box before load. The height comes from the optimiser rather than being
 * written down, so a re-export at a different aspect cannot leave the markup
 * reserving the old one.
 */
export const badgeImage = {
  src: optimised.src,
  srcset: optimised.srcSet.attribute,
  width: Number(optimised.attributes.width),
  height: Number(optimised.attributes.height),
} as const;
