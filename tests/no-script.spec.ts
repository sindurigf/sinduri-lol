import { expect, test } from '@playwright/test';
import { ROUTES } from './routes';

/**
 * Navigation with JavaScript disabled.
 *
 * Below `md` the primary <nav> in Header.astro is `hidden md:block`, so the
 * only navigation at that width is MobileMenu.vue. The island server-renders
 * its whole <dialog>, links included, but a <dialog> is display:none until
 * showModal() runs and the trigger cannot call it without hydration. Measured
 * on the built homepage before the fix: with scripting off at 320px a reader
 * could reach `/` from the logo and the footer's social links and no other
 * page, with the trigger sitting inert announcing aria-expanded="false".
 *
 * Each test builds its own context, because Playwright's `javaScriptEnabled`
 * is a context option and cannot be changed on a page that already exists.
 * That is also what makes this a real test rather than a markup assertion: it
 * asks a browser with scripting genuinely off what a reader can see and click,
 * which is the only way to prove `@media (scripting: none)` matched.
 *
 * It deliberately does not cover scripting enabled with hydration failing.
 * `scripting: none` does not match then, so the fallback stays hidden. That is
 * a real failure mode and a different one; see the client:load comment in
 * Header.astro for the trade it weighs.
 *
 * The fallback is visible by default and scoped with `md:hidden` rather than
 * revealed by an inline <style>. While the reveal lived in that <style>, a CSP
 * refusing it would have taken the whole fallback with it, silently, for
 * exactly the readers it exists for. The <style> now only hides the trigger.
 *
 * Proven able to fail, 2026-09-11, chromium:
 *
 *   - the `@media (scripting: none)` block deleted fails 29: all 25 per-route
 *     tests, the dead-trigger test and the three below-the-header widths. The
 *     1280px test and the scripted-browser test pass, because both assert the
 *     fallback is hidden, and it is;
 *   - the default `.noscript-nav { display: none }` deleted fails exactly "the
 *     fallback is hidden from a scripted browser";
 *   - the `.mobile-menu-island` rule inside that media query deleted fails
 *     exactly "the dead trigger is hidden rather than left inert".
 *
 * Earlier, 2026-09-10: deleting `md:hidden` from the fallback nav failed
 * exactly `the fallback does not duplicate the primary nav above the
 * breakpoint`, "locator resolved to 2 elements", and nothing else, because
 * every other test ran at 305px where the primary nav is hidden and the
 * duplication cannot be seen. That is why this file also runs at 1280px.
 *
 * A mutation has to be checked for a clean build before its result means
 * anything. Deleting the old <noscript> or its <style> with a loose regex
 * matched the mention inside the feature's own HTML comment and left markup
 * that did not compile, so the suite ran against a stale dist/ and passed.
 */

/**
 * The narrowest viewport the suite measures, where the primary nav is hidden.
 */
const MOBILE = { width: 305, height: 800 };

/**
 * A width where the primary nav is visible, so the fallback can collide with
 * it. Every other assertion here runs at 305px, the one band where the two
 * cannot be on screen together.
 */
const DESKTOP = { width: 1280, height: 800 };

/**
 * Widths below `md` where the fallback is the navigation: the suite's
 * narrowest, a common phone, and the last pixel before the primary nav takes
 * over.
 */
const FALLBACK_WIDTHS = [305, 390, 767] as const;

test.describe('navigation without JavaScript', () => {
  for (const route of ROUTES) {
    test(`${route} is navigable without JavaScript`, async ({ browser }) => {
      const context = await browser.newContext({
        javaScriptEnabled: false,
        viewport: MOBILE,
      });

      try {
        const page = await context.newPage();
        await page.goto(route);

        /*
         * By role and by what a reader can see. `toBeVisible` is the point:
         * the links were in the DOM before the fix too, shut inside a
         * <dialog>, so a presence assertion would have passed on the broken
         * build.
         */
        const fallback = page.locator('nav.noscript-nav');
        await expect(
          fallback,
          `${route} renders no visible fallback nav with scripting off. The ` +
            "links exist in the island's <dialog>, but a <dialog> is " +
            'display:none until showModal() runs, which needs the JavaScript ' +
            'that is off.',
        ).toBeVisible();

        for (const label of ['Home', 'About', 'Career', 'Blog']) {
          await expect(
            fallback.getByRole('link', { name: label, exact: true }),
            `${route} cannot reach ${label} without JavaScript`,
          ).toBeVisible();
        }
      } finally {
        await context.close();
      }
    });
  }

  test('the dead trigger is hidden rather than left inert', async ({
    browser,
  }) => {
    const context = await browser.newContext({
      javaScriptEnabled: false,
      viewport: MOBILE,
    });

    try {
      const page = await context.newPage();
      await page.goto('/');

      /*
       * A separate failure from the tests above: those ask whether a reader
       * can navigate, this asks whether they are also offered a control that
       * cannot work. An inert button reporting aria-expanded="false" tells a
       * screen reader there is a menu to open, and there is not.
       */
      await expect(
        page.locator('.mobile-menu-island'),
        'the menu trigger is still visible with scripting off. It cannot ' +
          'open anything, and it announces aria-expanded="false", which ' +
          'promises a menu that will never appear.',
      ).toBeHidden();
    } finally {
      await context.close();
    }
  });

  test('the fallback does not duplicate the primary nav above the breakpoint', async ({
    browser,
  }) => {
    const context = await browser.newContext({
      javaScriptEnabled: false,
      viewport: DESKTOP,
    });

    try {
      const page = await context.newPage();
      await page.goto('/');

      /*
       * The same question the scripted test below asks, put to the reader this
       * is built for, at a width where the primary nav is also on screen. With
       * `md:hidden` described in a comment and absent from the markup, the
       * header rendered both navs with scripting off: every link twice and two
       * landmarks both named "Primary", which is a landmark-unique failure of
       * SC 1.3.1.
       *
       * Counted by what is visible, not by what is in the DOM: both navs are
       * in the DOM at every width either way. Page-wide, not `header nav`,
       * because the fallback renders after the header rather than inside it.
       */
      await expect(
        page.locator('nav[aria-label="Primary"]:visible'),
        'with scripting off at this width the header offers more than one ' +
          'visible navigation named "Primary". A reader gets every link ' +
          'twice, and a screen reader enumerates two landmarks that cannot ' +
          'be told apart.',
      ).toHaveCount(1);

      /*
       * Which of the two survives is not incidental. The primary nav is the
       * one a reader already sees at this width; the fallback exists for a
       * width where the island cannot open.
       */
      await expect(
        page.locator('nav.noscript-nav'),
        'the wrong navigation survived above the breakpoint: the fallback ' +
          'is visible where the primary nav should be doing this job.',
      ).toBeHidden();
    } finally {
      await context.close();
    }
  });

  /*
   * Every fallback link is on the page, below the sticky header.
   *
   * The per-route tests above passed while the list was wrecking the page:
   * `toBeVisible` is true for a link drawn above the top of the document, or
   * pinned over the content by a sticky ancestor. The list used to sit inside
   * the header's fixed 96px row, and five wrapped links need more than that
   * below `md`.
   *
   * At scroll position 0 a link in normal flow after the header starts at or
   * below the header's bottom edge. One that starts above it is either above
   * the page, where nothing can scroll to it, or inside the sticky band, where
   * it goes wherever the band goes. 767px is the last width below `md`, where
   * the row has the most room and the spill was smallest.
   *
   * Proven able to fail, 2026-09-11: against the previous Header.astro, with
   * the list inside the header row, all six cases failed in chromium and
   * firefox, "Home" starting at -87px at 305px, -79px at 390px and -2px at
   * 767px against the header's 96px bottom edge.
   */
  for (const width of FALLBACK_WIDTHS) {
    test(`every fallback link starts below the header at ${width}px`, async ({
      browser,
    }) => {
      const context = await browser.newContext({
        javaScriptEnabled: false,
        viewport: { width, height: MOBILE.height },
      });

      try {
        const page = await context.newPage();
        await page.goto('/');

        const measured = await page.evaluate(() => {
          const header = document.querySelector('header');
          const nav = document.querySelector('nav.noscript-nav');
          if (!header || !nav) return null;
          return {
            scrollY: window.scrollY,
            headerBottom: header.getBoundingClientRect().bottom,
            links: [...nav.querySelectorAll('a')].map((link) => ({
              name: link.textContent?.trim() ?? '',
              top: link.getBoundingClientRect().top,
            })),
          };
        });

        expect(
          measured,
          'no header or no fallback nav with scripting off',
        ).not.toBeNull();
        expect(measured!.scrollY).toBe(0);
        expect(
          measured!.links.length,
          'the fallback nav has no links, so nothing below measured anything',
        ).toBeGreaterThan(0);

        for (const link of measured!.links) {
          expect(
            Math.round(link.top),
            `"${link.name}" starts at ${Math.round(link.top)}px, above the ` +
              `header's bottom edge at ${Math.round(measured!.headerBottom)}px ` +
              `at ${width}px. It is either above the page, where nothing ` +
              'scrolls to it, or inside the sticky header, where it stays ' +
              'pinned over the content.',
          ).toBeGreaterThanOrEqual(Math.round(measured!.headerBottom));
        }
      } finally {
        await context.close();
      }
    });
  }

  test('the fallback is hidden from a scripted browser', async ({ page }) => {
    await page.setViewportSize(MOBILE);
    await page.goto('/');

    /*
     * The fallback is an ordinary element, in the DOM on every page, so the
     * question is not whether it exists but whether a reader with JavaScript
     * on meets it: on screen, in the tab order, or as a landmark named
     * "Primary" enumerated alongside the real one.
     *
     * At this width with scripting on the header's own nav is `hidden
     * md:block` and the dialog's nav is unnamed, so no exposed landmark should
     * carry that name. One that does is the fallback leaking.
     */
    await expect(
      page.locator('nav.noscript-nav'),
      'the fallback nav is on screen with JavaScript enabled, beside a menu ' +
        'trigger that works.',
    ).toBeHidden();

    await expect(
      page.getByRole('navigation', { name: 'Primary', exact: true }),
      'a navigation named "Primary" is exposed with JavaScript enabled at ' +
        '305px, where the only one should be the hidden fallback. A screen ' +
        'reader now lists a landmark for links nobody can see.',
    ).toHaveCount(0);
  });
});
