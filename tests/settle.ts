import { expect, type Page, type Response } from '@playwright/test';

/**
 * Navigation helpers that wait for what the specs depend on: islands mounted
 * and the webfont loaded.
 *
 * They replace `waitUntil: 'networkidle'`, which resolves after 500ms with no
 * network activity and says nothing about hydration or fonts. `load` plus the
 * two checks below is faster and stricter, and a failure names its cause (an
 * island that never hydrated) instead of ending in a timeout.
 *
 * This does not fix the intermittent Firefox navigation stall in
 * tests/headers.spec.ts. That stall is in the harness: measured during one,
 * the page was `complete` with nothing in flight, and Playwright was never
 * told. `load`, `domcontentloaded` and `commit` all stall alike, so no
 * `waitUntil` avoids it. See the version pin and `retries` in
 * playwright.config.ts.
 */

/**
 * Waits for every island on the page to hydrate.
 *
 * Astro renders `<astro-island ssr>` and removes `ssr` once the component
 * mounts, so this is the page's own signal that the island script was
 * fetched, allowed by the CSP, and ran. The element itself stays, so it can
 * be counted.
 *
 * The first assertion is what makes the second mean anything: `toHaveCount(0)`
 * on `astro-island[ssr]` passes at once on a page with no islands, so without
 * it a route that lost its island, or an Astro that stopped emitting the
 * attribute, would turn every wait into a race.
 *
 * Every route has at least one island: the header's MobileMenu is
 * `client:load` on all 25, `/` adds the hero field and `/contact` the
 * spinning badge (checked against dist/, 2026-09-11). A page with no islands
 * needs a different wait, not a looser helper; tests/not-found.spec.ts uses a
 * plain `goto` for the host's 404 fallback.
 */
export const waitForHydration = async (page: Page): Promise<void> => {
  await expect(
    page.locator('astro-island'),
    'this page renders no islands at all, so the hydration wait below is ' +
      'waiting for nothing and every navigation using it has quietly become ' +
      'a race. Either a route stopped rendering the header island, or Astro ' +
      'stopped emitting <astro-island>.',
  ).not.toHaveCount(0);

  await expect(
    page.locator('astro-island[ssr]'),
    'an island never hydrated: Astro removes the `ssr` attribute when the ' +
      'component mounts, so one still carrying it means the island script ' +
      'did not run. A stale script hash in the CSP looks exactly like this.',
  ).toHaveCount(0);
};

/**
 * Navigate, then wait for the islands to mount and the webfont to load.
 *
 * `document.fonts.ready` is here, not left to callers, because every
 * measurement depends on it: a heading measured in the fallback face is
 * measured at the wrong width.
 *
 * Returns the navigation response, because several callers assert its status.
 */
export const gotoSettled = async (
  page: Page,
  route: string,
): Promise<Response | null> => {
  const response = await page.goto(route, { waitUntil: 'load' });
  await waitForHydration(page);
  await page.evaluate(() => document.fonts.ready);
  return response;
};
