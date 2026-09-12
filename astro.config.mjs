// @ts-check
import { defineConfig } from 'astro/config';

import cloudflare from '@astrojs/cloudflare';
import sitemap from '@astrojs/sitemap';
import vue from '@astrojs/vue';
import tailwindcss from '@tailwindcss/vite';
import { satteri } from '@astrojs/markdown-satteri';

import { linkListItem } from './src/plugins/link-list-item.mjs';

// https://astro.build/config
export default defineConfig({
  site: 'https://sinduri.lol',

  /*
   * Static by default: every page is prerendered to an asset. The adapter is
   * here for the handful of routes that opt out with `export const prerender =
   * false`, which reach the Worker instead.
   */
  output: 'static',

  /*
   * `prerenderEnvironment: 'node'` because the prerender step defaults to
   * workerd, where the build fails getting static paths: several pages read
   * files at build time. Only prerendering runs in node; the Worker itself is
   * unaffected.
   */
  adapter: cloudflare({
    prerenderEnvironment: 'node',

    /*
     * The adapter defaults to `cloudflare-binding`, which defers to a binding
     * that does not exist at build time, so every image ships at its master
     * size: badge-white 8.8-33 KB per density became 152 KB, badge-dark 63 KB
     * became 169 KB. Every image here is on a prerendered page, so the build
     * service is the only one that matters. tests/image-size.spec.ts measures
     * dimensions, not bytes, so it does not catch this.
     */
    imageService: { build: 'compile' },
  }),
  /*
   * The adapter enables sessions with a Cloudflare KV binding unless told not
   * to. Sessions are a cookie, and /privacy claims none; tests/privacy.spec.ts
   * asserts that claim.
   */
  session: false,

  /*
   * No `trailingSlash`. 'always' makes `astro preview` answer 404 for `/about`,
   * which every spec visits (measured 2026-09-11). Internal links carry the
   * slash instead, and tests/seo.spec.ts fails on any link that does not.
   */
  integrations: [
    /*
     * Options API off: every component uses <script setup>, so that half of
     * the Vue runtime only added bytes to the bundle every page loads.
     */
    vue({ features: { optionsAPI: false } }),
    /*
     * `site` above is what makes this work: every entry is an absolute URL and
     * the integration has no other way to know the origin.
     *
     * The output is `sitemap-index.xml` plus `sitemap-0.xml`, the
     * integration's shape rather than a setting. It is what the
     * `<link rel="sitemap">` in BaseLayout.astro and the `Sitemap:` line in
     * robots.txt both point at, and tests/sitemap.spec.ts asserts the three
     * agree, so the name cannot drift in one place only.
     *
     * No `filter`, deliberately. `/404` should not be advertised: Cloudflare
     * serves that page's body as the 404 for every wrong address, so listing
     * it asks a crawler to index the error page under the one URL where it is
     * not an error (same reasoning as BaseLayout's `noCanonical` prop). A
     * filter for it was removed because it never fired: the integration keeps
     * its own `STATUS_CODE_PAGES` set of "404" and "500" and drops both before
     * any filter runs, measured 2026-09-09 with the filter and without.
     * tests/sitemap.spec.ts still asserts the error page is unadvertised,
     * which now guards the integration's behaviour rather than ours.
     */
    sitemap(),
  ],

  /*
   * A list item that is nothing but a link gets a class here, so `.prose`
   * can size it to SC 2.5.8. The plugin's own comment says why this cannot
   * be a CSS selector, and why it is a Sätteri visitor rather than a rehype
   * plugin.
   *
   * `satteri()` is what Astro 7 defaults this option to, so naming it here
   * changes nothing but the plugin list.
   */
  markdown: {
    processor: satteri({ hastPlugins: [linkListItem] }),
  },

  vite: {
    plugins: [tailwindcss()],
  },
});
