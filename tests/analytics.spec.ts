import { readFileSync } from 'node:fs';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { join } from 'node:path';
import { expect, test, type Page } from './test';
import {
  CLICK_EVENTS,
  UMAMI_HOST_URL,
  UMAMI_SCRIPT_PATH,
  UMAMI_WEBSITE_ID,
} from '../src/lib/analytics';
import { parseHeadersFile, startServer } from './policy-server';
import { builtPages, DIST_DIR } from './routes';
import { waitForHydration } from './settle';
import { configuredSite } from './source';
import { fakeCollector, type UmamiSend } from './umami';

/**
 * Umami, held to what /privacy says about it.
 *
 * The tracker only sends from the production host, so a test at 127.0.0.1
 * would pass with analytics entirely broken. These tests therefore serve the
 * build as `site` from astro.config.mjs: requests to that origin are answered
 * from tests/policy-server.ts, with public/_headers applied, so the CSP is
 * the one production sends. Requests to Umami go to tests/umami.ts, and never
 * reach the real collector.
 *
 * PAYLOAD_KEYS and EVENT_DATA_KEYS are the fields /privacy discloses. An
 * upstream tracker that starts sending another one fails here, naming it.
 *
 * Proven able to fail, 2026-09-13, each mutation reverted afterwards:
 *
 *   - dropping Umami from `connect-src` in public/_headers fails the page
 *     view, both click tests and the contact form test, because the CSP
 *     really refuses the request under this serving;
 *   - removing `data-do-not-track` and emptying `data-domains` fails the
 *     configuration test, "Do Not Track sends nothing" and "nothing is sent
 *     from any host but production";
 *   - making src/scripts/track-clicks.ts not call `umami.track` fails both
 *     click tests;
 *   - adding a field to the vendored tracker's payload fails "a page view is
 *     sent, with only the fields /privacy lists".
 */

const SITE = configuredSite().replace(/\/$/, '');

const PAYLOAD_KEYS = [
  'website',
  'screen',
  'language',
  'title',
  'hostname',
  'url',
  'referrer',
  'tag',
  'id',
  'name',
  'data',
];
const EVENT_DATA_KEYS = ['label', 'area', 'target'];

const SEND_TIMEOUT_MS = 10_000;

/*
 * How long a test waits to be sure nothing was sent. The tracker sends a page
 * view as soon as the document is complete, so a second after hydration is
 * well past the point it would have.
 */
const QUIET_PERIOD_MS = 1_000;

let server: Server;
let localOrigin: string;

test.beforeAll(async () => {
  server = await startServer(
    parseHeadersFile(readFileSync(join(DIST_DIR, '_headers'), 'utf8')),
  );
  localOrigin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

/*
 * A test ends once its assertion holds, while the page it opened is still
 * loading lazy images and video through the production route. Closing the
 * context then discards the response a handler is between route.fetch() and
 * route.fulfill() on, and the test fails with "Fetch response has been
 * disposed" after every assertion in it has passed.
 *
 * `ignoreErrors` only covers handlers still running after the test body has
 * returned, so it cannot hide a failure the test asserts on. `wait` is not an
 * alternative: a request arriving while the routes are removed is continued by
 * Playwright and its handler then fails with "Route is already handled!",
 * measured at 7 of 240 runs.
 *
 * Reproduced 2026-09-16, chromium: "a followed internal link is counted and
 * still navigates" failed 4 of 20 runs with --repeat-each=10 before this hook.
 */
test.afterEach(async ({ context }) => {
  await context.unrouteAll({ behavior: 'ignoreErrors' });
});

test.afterAll(async () => {
  await new Promise<void>((done) => server.close(() => done()));
});

/**
 * Serves the build as production, and stubs every other origin so a followed
 * outbound link lands on an empty page instead of the network.
 */
const openAsProduction = async (
  page: Page,
  path: string,
): Promise<UmamiSend[]> => {
  const context = page.context();

  await context.route(
    (url) => url.origin !== SITE && !url.href.startsWith(UMAMI_HOST_URL),
    (route) => route.fulfill({ status: 200, body: '' }),
  );
  await context.route(`${SITE}/**`, async (route) => {
    const { pathname, search } = new URL(route.request().url());
    const response = await route.fetch({
      url: `${localOrigin}${pathname}${search}`,
    });
    await route.fulfill({ response });
  });
  const sent = await fakeCollector(context);

  await page.goto(`${SITE}${path}`);
  await waitForHydration(page);
  return sent;
};

const events = (sent: UmamiSend[]): Record<string, unknown>[] =>
  sent.filter(({ payload }) => 'name' in payload).map(({ payload }) => payload);

/*
 * Stops a followed link from leaving the page, from a listener on the link
 * itself, which runs after the document-level capture listener being tested.
 */
const holdNavigation = async (page: Page, selector: string): Promise<void> => {
  await page
    .locator(selector)
    .first()
    .evaluate((link) =>
      link.addEventListener('click', (event) => event.preventDefault()),
    );
};

test.describe('analytics', () => {
  test('every page loads the vendored tracker, configured as /privacy says', () => {
    const host = new URL(SITE).hostname;

    for (const { route, file } of builtPages()) {
      const html = readFileSync(file, 'utf8');
      const tags = [...html.matchAll(/<script\b[^>]*umami[^>]*>/g)].map(
        (match) => match[0],
      );

      expect(
        tags,
        `${route} should load the tracker exactly once`,
      ).toHaveLength(1);
      const tag = tags[0]!;

      expect(
        tag,
        `${route} loads the tracker from somewhere other than this origin`,
      ).toContain(`src="${UMAMI_SCRIPT_PATH}"`);
      expect(tag).toContain(`data-website-id="${UMAMI_WEBSITE_ID}"`);
      expect(tag).toContain(`data-host-url="${UMAMI_HOST_URL}"`);
      expect(
        tag,
        `${route}: without data-domains every localhost run and preview deploy is counted`,
      ).toContain(`data-domains="${host}"`);
      expect(
        tag,
        `${route}: /privacy says a browser with Do Not Track on sends nothing`,
      ).toContain('data-do-not-track="true"');
    }
  });

  test('the served tracker is the vendored file, unmodified', () => {
    const vendored = readFileSync(join('public', UMAMI_SCRIPT_PATH));
    const built = readFileSync(join(DIST_DIR, UMAMI_SCRIPT_PATH));

    expect(
      built.equals(vendored),
      `${UMAMI_SCRIPT_PATH} in the build differs from public/. The copy is ` +
        'kept byte-identical to upstream so `npm run check:umami` can compare it.',
    ).toBe(true);
  });

  test('nothing is sent from any host but production', async ({ page }) => {
    const sent = await fakeCollector(page.context());

    await page.goto(`${localOrigin}/`);
    await waitForHydration(page);
    await page.getByRole('link', { name: 'Privacy' }).first().click();
    await page.waitForURL('**/privacy/');
    await page.waitForTimeout(QUIET_PERIOD_MS);

    expect(
      sent,
      'the tracker sent from 127.0.0.1. data-domains is what stops tests and ' +
        'previews being counted.',
    ).toEqual([]);
  });

  test('a page view is sent, with only the fields /privacy lists', async ({
    page,
  }) => {
    const sent = await openAsProduction(page, '/about/');

    await expect
      .poll(() => sent.length, { timeout: SEND_TIMEOUT_MS })
      .toBeGreaterThan(0);

    const [view] = sent;
    expect(view!.type).toBe('event');
    expect(view!.payload.website).toBe(UMAMI_WEBSITE_ID);
    expect(String(view!.payload.url)).toContain('/about/');

    const undisclosed = Object.keys(view!.payload).filter(
      (key) => !PAYLOAD_KEYS.includes(key),
    );
    expect(
      undisclosed,
      'the tracker now sends field(s) /privacy does not list. Update the ' +
        '"Visit counts" section and PAYLOAD_KEYS in the same commit.',
    ).toEqual([]);
  });

  test('Do Not Track sends nothing', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(Navigator.prototype, 'doNotTrack', {
        get: () => '1',
      });
    });
    const sent = await openAsProduction(page, '/');
    await page.waitForTimeout(QUIET_PERIOD_MS);

    expect(sent, '/privacy says Do Not Track stops all sending').toEqual([]);
  });

  test('a followed internal link is counted and still navigates', async ({
    page,
  }) => {
    const sent = await openAsProduction(page, '/');

    await page
      .getByRole('contentinfo')
      .getByRole('link', { name: 'Privacy' })
      .click();
    await page.waitForURL(`${SITE}/privacy/`);

    await expect
      .poll(() => events(sent), { timeout: SEND_TIMEOUT_MS })
      .toContainEqual(
        expect.objectContaining({
          name: CLICK_EVENTS.internalLink,
          data: { label: 'Privacy', area: 'footer', target: '/privacy/' },
        }),
      );
  });

  test('outbound, download, email and button clicks are counted', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 720 });
    const sent = await openAsProduction(page, '/career/');

    const outbound = 'footer a[href^="https://github.com/"]';
    const download = 'a[href$=".pdf"]';
    const email = 'footer a[href^="mailto:"]';
    for (const selector of [outbound, download, email]) {
      await holdNavigation(page, selector);
      await page.locator(selector).first().click();
    }
    await page.getByRole('button', { name: /menu/i }).click();

    const recorded = (): Record<string, unknown>[] => events(sent);
    await expect
      .poll(() => recorded().length, { timeout: SEND_TIMEOUT_MS })
      .toBeGreaterThanOrEqual(4);

    const byName = (name: string) =>
      recorded().find((event) => event.name === name);

    expect(byName(CLICK_EVENTS.outboundLink)).toMatchObject({
      data: { area: 'footer', target: 'https://github.com/sindurigf' },
    });
    expect(byName(CLICK_EVENTS.download)).toMatchObject({
      data: { target: '/sinduri-guntupalli-cv.pdf' },
    });
    expect(
      (byName(CLICK_EVENTS.email)?.data as Record<string, unknown>)?.target,
      'an email click should not send the address',
    ).toBeUndefined();
    expect(byName(CLICK_EVENTS.button)).toMatchObject({
      data: { area: 'header' },
    });

    for (const event of recorded()) {
      const extra = Object.keys(event.data as object).filter(
        (key) => !EVENT_DATA_KEYS.includes(key),
      );
      expect(extra, 'a click event sends data /privacy does not list').toEqual(
        [],
      );
    }
  });

  test('typing into the contact form sends nothing', async ({ page }) => {
    const sent = await openAsProduction(page, '/contact/');
    await expect
      .poll(() => sent.length, { timeout: SEND_TIMEOUT_MS })
      .toBeGreaterThan(0);
    const before = sent.length;

    const secret = 'do-not-send-this-text';
    await page.getByRole('textbox').first().click();
    await page.getByRole('textbox').first().fill(secret);
    await page.waitForTimeout(QUIET_PERIOD_MS);

    expect(
      JSON.stringify(sent),
      '/privacy says what you type is never sent to Umami',
    ).not.toContain(secret);
    expect(
      sent.length,
      'clicking into a field is not a click on a control',
    ).toBe(before);
  });
});
