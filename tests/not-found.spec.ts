import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import ts from 'typescript';
import { DIST_DIR } from './routes';

/**
 * The site is static with no SPA fallback, so what a request for a path with
 * no file behind it returns is decided by the host. Cloudflare Pages serves
 * `404.html` from the build output with a 404 status if it is there, and falls
 * back to `index.html` with a 200 if it is not.
 *
 * That fallback is not hypothetical: measured against the deployed site on
 * 2026-09-04, before this page existed, every unknown path answered 200 with
 * the homepage. Crawlers index those URLs, link checkers pass them, and a
 * screen reader user is read the homepage with nothing to say the address was
 * wrong.
 *
 * The route list is not enough. `/404` is in tests/routes.ts and other suites
 * visit it, but `astro preview` serves `dist/404.html` at that path directly
 * with a 200, so those assertions pass on the file existing and would keep
 * passing while unknown paths returned 200 forever.
 *
 * Preview answers an unknown path with a 404 whether or not this page exists:
 * with src/pages/404.astro deleted it returns its own "404: Not Found" body,
 * still with a 404 status. So in preview the body is what proves the page is
 * wired up, while the status is what matters in production. Both are asserted,
 * so neither host's behaviour is taken on trust.
 *
 * The artefact test is the load-bearing one for Cloudflare: `404.html` in the
 * build output is the whole of what stops the 200. Re-check the deployed site
 * with `curl` after a deploy; see README.
 *
 * Workers needs one more thing. Workers static assets does not look for
 * `404.html` on its own: it serves it only when `wrangler.jsonc` sets
 * `assets.not_found_handling` to `"404-page"`, so there the file and the
 * setting are both required and preview shows neither. The config test below
 * reads the setting.
 *
 * Proven able to fail: with src/pages/404.astro deleted and the site rebuilt,
 * the artefact test fails on the missing file and both path tests fail on the
 * body, preview's own page. With the `not_found_handling` line deleted from
 * wrangler.jsonc, the config test failed with `Received: undefined`
 * (2026-09-11).
 */

const NOT_FOUND_HEADING = /page not found/i;
const WRANGLER_CONFIG = 'wrangler.jsonc';
const WORKERS_NOT_FOUND_HANDLING = '404-page';

interface WranglerConfig {
  assets?: { not_found_handling?: string };
}

/**
 * `wrangler.jsonc` allows comments and trailing commas, which `JSON.parse`
 * rejects. TypeScript's own tsconfig reader accepts both.
 */
const readWranglerConfig = (): WranglerConfig => {
  const { config, error } = ts.parseConfigFileTextToJson(
    WRANGLER_CONFIG,
    readFileSync(WRANGLER_CONFIG, 'utf8'),
  );
  if (error) {
    throw new Error(
      `${WRANGLER_CONFIG} does not parse: ` +
        ts.flattenDiagnosticMessageText(error.messageText, '\n'),
    );
  }
  return config as WranglerConfig;
};

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

  test('wrangler.jsonc tells Workers to serve 404.html', () => {
    expect(
      readWranglerConfig().assets?.not_found_handling,
      `Workers serves dist/404.html for an unknown path only when ` +
        `${WRANGLER_CONFIG} sets assets.not_found_handling to ` +
        `"${WORKERS_NOT_FOUND_HANDLING}". Without it the deployed Worker ` +
        `stops serving this site's 404 page.`,
    ).toBe(WORKERS_NOT_FOUND_HANDLING);
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
