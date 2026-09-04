import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { DIST_DIR } from './routes';

/**
 * The site is static and has no SPA fallback of its own, so what a request for
 * a path with no file behind it returns is decided entirely by the host. On
 * Cloudflare Pages the rule is: serve `404.html` from the build output with a
 * 404 status if it is there, and fall back to `index.html` with a 200 if it is
 * not.
 *
 * The fallback is not hypothetical. Measured against the deployed site on
 * 2026-09-04, before this page existed:
 *
 *   GET https://sinduri.lol/definitely-not-a-real-path-9f3a  200, <title>sinduri.lol</title>
 *   GET https://sinduri.lol/blog/nope/deeper                 200
 *   GET https://sinduri.lol/images/nope.png                  200
 *
 * Every dead inbound link, every typo, and every renamed route was answering
 * with the homepage and reporting success. Crawlers index those URLs, link
 * checkers pass them, and someone using a screen reader is read the homepage
 * with nothing to say the address was wrong.
 *
 * WHY THE ROUTE LIST IS NOT ENOUGH. `/404` is in tests/routes.ts and the a11y
 * and reflow suites visit it, but `astro preview` serves `dist/404.html` at
 * that path directly and returns 200. That assertion passes on the file
 * existing and would keep passing while unknown paths returned 200 forever.
 *
 * WHAT PREVIEW CAN AND CANNOT SHOW. `astro preview` answers an unknown path
 * with a 404 whether or not this page exists: with src/pages/404.astro deleted
 * it returns its own built-in "404: Not Found" body, still with a 404 status.
 * So in preview the status code alone does not prove the page is wired up, and
 * the assertion that does is the body. The status assertion is still the one
 * that matters in production, where a 200 is exactly the regression above, and
 * both are asserted here so neither host's behaviour is taken on trust.
 *
 * The artefact test is the load-bearing one for Cloudflare: `404.html` present
 * in the build output is the whole of what makes Cloudflare stop serving the
 * 200. Re-check the deployed site with `curl` after the first deploy; see
 * README.
 *
 * Verified not to be vacuous: with src/pages/404.astro deleted and the site
 * rebuilt, the artefact test fails on the missing file and both path tests
 * fail on the body ("404:  Not Found", preview's own page). Restored, all
 * three pass.
 */

const NOT_FOUND_HEADING = /page not found/i;

/** Random, so no future page can accidentally start answering on this path. */
const unknownPaths = (): string[] => [
  `/no-such-page-${crypto.randomUUID()}`,
  `/blog/${crypto.randomUUID()}/deeper/still`,
];

test.describe('unknown paths return 404', () => {
  test('the build emits 404.html, which is what Cloudflare Pages reads', () => {
    const artefact = join(DIST_DIR, '404.html');

    expect(
      existsSync(artefact),
      `${artefact} is missing. Cloudflare Pages falls back to serving ` +
        `index.html with a 200 for every unknown path without it, which is ` +
        `what the deployed site did before this page existed.`,
    ).toBe(true);
  });

  for (const [index, route] of unknownPaths().entries()) {
    const depth = index === 0 ? 'top-level' : 'nested';

    test(`a ${depth} path that does not exist returns 404 and this site's page`, async ({
      page,
    }) => {
      const response = await page.goto(route);

      expect(
        response?.status(),
        `${route} returned ${response?.status()}. A 200 here means every ` +
          `dead link reports success.`,
      ).toBe(404);

      await expect(
        page.getByRole('heading', { level: 1 }),
        `the 404 response did not carry this site's 404 page, so the status ` +
          `code is coming from the host's own fallback rather than from ` +
          `dist/404.html`,
      ).toHaveText(NOT_FOUND_HEADING);
    });
  }
});
