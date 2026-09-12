import type { APIRoute } from 'astro';
import { themeColor } from '../lib/theme-color';

/*
 * The web app manifest, generated rather than served as a static file.
 *
 * WHY IT IS NOT public/site.webmanifest. The icon pack ships one with
 * `theme_color` and `background_color` hardcoded to the brand gold. Two
 * things are wrong with that:
 *
 *   - It disagrees with the page. `<meta name="theme-color">` emits
 *     `--color-background`, so an installed app would paint its title bar
 *     gold while every page tints the address bar dark, and the splash screen
 *     would flash yellow before handing over to a dark page.
 *   - It duplicates a colour outside global.css, where
 *     scripts/check-tokens.mjs cannot see it: that check walks src/ for
 *     .astro, .vue, .ts and .css only. Generating the file puts the value
 *     back under the token and under the check.
 *
 * The icons are deliberately literal paths: static files in public/, not
 * tokens, and nothing derives them.
 */

const MANIFEST = {
  name: 'sinduri.lol',
  short_name: 'sinduri',
  start_url: '/',
  display: 'standalone',
  theme_color: themeColor,
  background_color: themeColor,
  icons: [
    {
      src: '/android-chrome-192x192.png',
      sizes: '192x192',
      type: 'image/png',
    },
    {
      src: '/android-chrome-512x512.png',
      sizes: '512x512',
      type: 'image/png',
    },
    /*
     * `maskable` is a separate entry rather than a `purpose` on the 512
     * above. A launcher masks a maskable icon to its own shape, so that
     * artwork is padded to keep the mark inside the central 80% safe zone.
     * Declaring one image as both purposes lets a launcher wanting an
     * unmasked icon pick the padded one and draw the mark too small.
     */
    {
      src: '/maskable-icon-512x512.png',
      sizes: '512x512',
      type: 'image/png',
      purpose: 'maskable',
    },
  ],
};

export const GET: APIRoute = () =>
  new Response(JSON.stringify(MANIFEST, null, 2), {
    headers: {
      /*
       * The registered type for a manifest. public/_headers cannot set it,
       * because this endpoint builds the file, and a host guessing from the
       * `.webmanifest` extension is not something to rely on.
       */
      'Content-Type': 'application/manifest+json; charset=utf-8',
    },
  });
