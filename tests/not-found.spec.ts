import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from './test';
import ts from 'typescript';
import { DIST_DIR } from './routes';
import { gotoSettled } from './settle';
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

/** Phone, the last width below `lg`, and desktop: the two star layouts and their seam. */
const STARFIELD_WIDTHS = [320, 1023, 1280] as const;

for (const width of STARFIELD_WIDTHS) {
  test.describe(`the 404 starfield at ${width}px`, () => {
    test.use({ viewport: { width, height: 900 } });

    test('is hidden from assistive technology and covers no text', async ({
      page,
    }) => {
      await gotoSettled(page, '/404');
      const stars = page.locator('main .plain-slab-stars');
      await expect(stars).toHaveAttribute('aria-hidden', 'true');

      const { measured, covered } = await stars.evaluate((layer) => {
        const field = layer.getBoundingClientRect();
        const slab = layer.closest('.plain-slab');
        const texts = [...(slab?.querySelectorAll('p, h1') ?? [])];
        const covered = texts
          .filter((text) => {
            const box = text.getBoundingClientRect();
            return (
              box.left < field.right &&
              field.left < box.right &&
              box.top < field.bottom &&
              field.top < box.bottom
            );
          })
          .map((text) => text.textContent?.trim().slice(0, 40));
        return { measured: texts.length, covered };
      });
      expect(measured, 'no text found in the slab to measure').toBeGreaterThan(
        0,
      );
      expect(covered, 'the starfield overlaps text in the slab').toEqual([]);
    });
  });
}
