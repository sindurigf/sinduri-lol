import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from './test';
import ts from 'typescript';
import { DIST_DIR } from './routes';
import { NODE } from './tags';

/**
 * Workers serves `404.html` with a 404 only when the file exists and
 * `wrangler.jsonc` sets `not_found_handling`. The local server 404s regardless,
 * so the body proves the page is wired; `npm run check:live` covers production.
 */

const NOT_FOUND_HEADING = /these are not the droids you are looking for/i;
const WRANGLER_CONFIG = 'wrangler.jsonc';
const WORKERS_NOT_FOUND_HANDLING = '404-page';

interface WranglerConfig {
  assets?: { not_found_handling?: string };
}

/** JSONC: `JSON.parse` rejects its comments and trailing commas; TypeScript's reader does not. */
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
  test('the build emits 404.html, which is what Workers serves', NODE, () => {
    const artefact = join(DIST_DIR, '404.html');

    expect(
      existsSync(artefact),
      `${artefact} is missing, so unknown paths get no 404 page.`,
    ).toBe(true);
  });

  test('wrangler.jsonc tells Workers to serve 404.html', NODE, () => {
    expect(
      readWranglerConfig().assets?.not_found_handling,
      `${WRANGLER_CONFIG} must set assets.not_found_handling to "${WORKERS_NOT_FOUND_HANDLING}".`,
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
        `${route} returned ${response?.status()}, not 404.`,
      ).toBe(404);

      await expect(
        page.getByRole('heading', { level: 1 }),
        `the 404 response came from the host's fallback, not dist/404.html.`,
      ).toHaveText(NOT_FOUND_HEADING);
    });
  }
});
