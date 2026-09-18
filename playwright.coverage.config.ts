import { defineConfig } from '@playwright/test';
import base from './playwright.config';
import { TEST_PORT } from './tests/ports';

/*
 * `npm run test:coverage`: the test:a11y suite in Chromium only, reporting
 * which lines of the site's own JavaScript it ran. tests/test.ts collects V8
 * coverage per test when COVERAGE=1, and monocart-reporter maps it back to
 * src/ through the source maps astro.config.mjs emits for this build alone.
 *
 * What it can see is the code a browser runs: the Vue islands, the hero field
 * and the page scripts. Frontmatter, endpoints and src/lib code used only at
 * build time never reach the browser, and the Worker runs in workerd, so none
 * of that is in the number. Most of this site is static HTML that the suite
 * checks by reading it, which line coverage does not describe.
 *
 * The report is written to coverage/, which is not committed.
 */
export default defineConfig({
  ...base,
  projects: base.projects?.filter((project) => project.name === 'chromium'),
  reporter: [
    ['list'],
    [
      'monocart-reporter',
      {
        name: 'sinduri.lol coverage',
        outputFile: './coverage/index.html',
        coverage: {
          /*
           * Only scripts this run's own server sent, mapped back into src/.
           * The specs also load pages from loopback servers of their own and
           * under the production hostname, whose source maps cannot be
           * fetched: left in, those arrive as unmapped bundles, the Vue
           * runtime among them, and the totals measure the libraries rather
           * than the site.
           */
          entryFilter: (entry: { url: string }) =>
            entry.url.startsWith(`http://localhost:${TEST_PORT}/_astro/`),
          sourceFilter: {
            '**/node_modules/**': false,
            '**/src/**': true,
            '**/**': false,
          },
          reports: ['console-summary', 'v8', 'lcovonly'],
          outputDir: './coverage',
        },
      },
    ],
  ],
});
