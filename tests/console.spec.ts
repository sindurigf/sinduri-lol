import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { DIST_DIR, ROUTES } from './routes';
import { waitForHydration } from './settle';
import {
  collectViolations,
  parseHeadersFile,
  startServer,
} from './policy-server';

/**
 * Every route loads without a console error, an uncaught exception, a CSP
 * violation or a failed request.
 *
 * It runs under the published policy, not against the suite's static server,
 * which sends no headers: a page can be clean with no CSP and break under one,
 * and that is the failure this is for. Until this spec existed, only `/` was
 * ever checked for violations, in tests/headers.spec.ts.
 *
 * Two modes:
 *
 *   - In the suite, against the build, served with public/_headers by
 *     tests/policy-server.ts. This catches what the repository causes.
 *   - Against production, with `npm run check:live:console`, which sets
 *     LIVE_ORIGIN. This is the only place something Cloudflare injects at the
 *     edge can be seen: on 2026-09-12 JavaScript Detections added an inline
 *     script to every HTML page whose hash changes per request, so no CSP hash
 *     can allow it, and every page logged a refusal. The fix for that is a zone
 *     setting, not a file in this repository, so the build run cannot catch it
 *     and the live run exists to.
 */

const LIVE_ORIGIN = process.env.LIVE_ORIGIN?.replace(/\/$/, '');

/*
 * Same mitigation as tests/headers.spec.ts, for the same Playwright bug: Firefox
 * intermittently stops delivering navigation lifecycle events for an origin
 * other than the suite's server, and a stalled navigation never recovers.
 * playwright.config.ts records it.
 */
test.use({ navigationTimeout: 15_000 });
test.describe.configure({ retries: process.env.CI ? 2 : 0 });

test.describe('the browser console', () => {
  let server: Server | undefined;
  let origin: string;

  test.beforeAll(async () => {
    if (LIVE_ORIGIN) {
      origin = LIVE_ORIGIN;
      return;
    }

    const rules = parseHeadersFile(
      readFileSync(join(DIST_DIR, '_headers'), 'utf8'),
    );
    server = await startServer(rules);
    const { port } = server.address() as AddressInfo;
    origin = `http://127.0.0.1:${port}`;
  });

  test.afterAll(async () => {
    if (server) await new Promise<void>((done) => server!.close(() => done()));
  });

  for (const route of ROUTES) {
    test(`${route} loads without errors`, async ({ page }) => {
      const problems: string[] = [];

      page.on('console', (message) => {
        if (message.type() === 'error') {
          problems.push(`console error: ${message.text()}`);
        }
      });
      page.on('pageerror', (error) => {
        problems.push(`uncaught exception: ${error.message}`);
      });
      page.on('requestfailed', (request) => {
        problems.push(
          `request failed: ${request.url()} (${request.failure()?.errorText ?? 'unknown'})`,
        );
      });
      page.on('response', (response) => {
        const isDocument = response.request().resourceType() === 'document';
        if (!isDocument && response.status() >= 400) {
          problems.push(`HTTP ${response.status()}: ${response.url()}`);
        }
      });

      const violations = await collectViolations(page);

      await page.goto(`${origin}${route}`);
      await waitForHydration(page);

      expect(
        [...problems, ...violations.map((v) => `CSP violation: ${v}`)],
        `${route} on ${origin} is not clean. A console error here is one a ` +
          'reader sees in their browser and the suite otherwise would not.',
      ).toEqual([]);
    });
  }
});
