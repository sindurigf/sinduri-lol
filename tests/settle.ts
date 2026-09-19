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
 * Waits for the page's scripts: the header menu wired and every island
 * hydrated.
 *
 * The mobile menu is on every route and marks its wrapper `data-menu-ready`
 * once src/scripts/mobile-menu.ts has run, so this is the page's own signal
 * that the bundled script was fetched, allowed by the CSP, and ran.
 *
 * Astro renders `<astro-island ssr>` and removes `ssr` once the component
 * mounts. Only `/` has an island, the hero field, so the second assertion
 * passes at once elsewhere; the first is what keeps every wait from being a
 * race. A page without the header needs a different wait, not a looser
 * helper; tests/not-found.spec.ts uses a plain `goto` for the host's 404
 * fallback.
 */
export const waitForHydration = async (page: Page): Promise<void> => {
  await expect(
    page.locator('[data-mobile-menu][data-menu-ready]'),
    'the header menu never marked itself ready, so its script did not run. ' +
      'A failed module load or a route without the header looks like this.',
  ).toHaveCount(1);

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

/**
 * The budget for one test that navigates through every route in turn, which
 * the 30s default does not cover as ROUTES grows or the machine is loaded.
 * Measured 2026-09-18, firefox, the reduced-motion sweep in
 * tests/motion.spec.ts over 25 routes: 3.7s alone, about 22s with 16 workers
 * running it at once, and past 30s once in a full local run.
 */
const SWEEP_BUDGET_PER_ROUTE_MS = 3_000;

export const sweepTimeout = (routeCount: number): number =>
  SWEEP_BUDGET_PER_ROUTE_MS * routeCount;
