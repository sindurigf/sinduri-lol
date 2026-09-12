import { expect, test } from '@playwright/test';
import { CTA, HOME_HREF, NAV_LINKS, isActive } from '../src/lib/nav';
import { ROUTES } from './routes';
import { gotoSettled } from './settle';

/**
 * Which navigation item is marked as the current page.
 *
 * Two tiers. `isActive` is asserted directly, against paths this site does not
 * have; the rendered pages are asserted through a browser, against paths it
 * does.
 *
 * The prefix defect is why. `isActive` was a bare `startsWith`, so `/career`
 * matched `/careers` and `/blog` matched `/blog-archive`. No route on this
 * site collides, so a browser-driven walk over ROUTES cannot see that bug at
 * all: every page renders correctly and always did. Calling the function with
 * the collision is the only assertion that bites.
 *
 * The reverse holds for the second tier. `aria-current` reaching all three
 * navigations, the desktop nav, the island's dialog and the no-JavaScript
 * fallback, is a property of three call sites that used to disagree, not of
 * the function.
 *
 * Proven able to fail, chromium:
 *
 *   - 2026-09-10: the bare `currentPath.startsWith(href)` restored fails only
 *     `a longer route with the same prefix is not the current page`, "expected
 *     false, received true" for `/careers` against `/career`. Every
 *     browser-driven test here still passes, which is what the old suite
 *     looked like;
 *   - 2026-09-10: `aria-current` dropped from the header's call to action
 *     fails 2, the header test and `the current call to action is drawn as
 *     well as announced`, because the ring is selected by that attribute;
 *   - 2026-09-10: the `.nav-cta[aria-current='page']` rule deleted from
 *     global.css fails only the drawn test, the attribute still in place. That
 *     asymmetry is why the two are separate: the CSS can go without the
 *     markup, and then the state reaches a screen reader and nobody else;
 *   - 2026-09-11: `aria-current` removed from the header's logo link fails
 *     `the logo marks the homepage, which the desktop nav does not list`, and
 *     mapping `NAV_LINKS` instead of `HEADER_LINKS` in the desktop nav fails
 *     the same test on "the desktop nav lists Home again".
 */
/**
 * The header's call to action, which is no longer inside the navigation.
 * Centring the links moved it into the next grid track, so
 * `nav a[href="/contact"]` stopped matching it. The sibling combinator says
 * what is meant, and unlike `header a.nav-cta` it does not also match the copy
 * inside the mobile dialog, which is in the DOM at every width.
 */
const HEADER_NAV = 'header nav[aria-label="Primary"]';
const HEADER_CTA = `${HEADER_NAV} + div a[href="${CTA.href}"]`;

/**
 * The logo link: a direct child of the header's row, and the only link to `/`
 * in the desktop header since Home left the nav. The child combinator keeps
 * out the mobile dialog's Home link, which is in the DOM at every width.
 */
const HEADER_LOGO = `header > div > a[href="${HOME_HREF}"]`;

test.describe('the current page, as the navigation reports it', () => {
  test('a route is its own current page', () => {
    for (const link of [...NAV_LINKS, CTA]) {
      expect(
        isActive(link.href, link.href),
        `${link.href} does not mark itself as the current page`,
      ).toBe(true);

      // Dev serves `/about` as well as `/about/`, so the unslashed path counts.
      const unslashed =
        link.href === HOME_HREF ? link.href : link.href.replace(/\/$/, '');
      expect(
        isActive(unslashed, link.href),
        `${unslashed} does not mark ${link.href} as the current page`,
      ).toBe(true);
    }
  });

  test('a route below a nav item is that nav item', () => {
    /*
     * The Blog item stays lit on a post and on a paginated listing. This is
     * the behaviour the prefix match got right and that a plain equality test
     * would have broken, so it is asserted rather than assumed.
     */
    for (const href of ['/blog', '/blog/']) {
      for (const path of ['/blog/some-post/', '/blog/page/2', '/blog/travel']) {
        expect(
          isActive(path, href),
          `${path} does not fall under the Blog nav item (${href})`,
        ).toBe(true);
      }
    }
  });

  test('a longer route with the same prefix is not the current page', () => {
    /*
     * None of these paths exist here, deliberately: no page-driven test can
     * make this assertion until somebody adds one of them, by which time the
     * bug is live. Each pair is a real route against a plausible sibling.
     */
    const collisions = [
      { path: '/careers', href: '/career' },
      { path: '/blog-archive', href: '/blog' },
      { path: '/about-me', href: '/about' },
      { path: '/contact-form', href: '/contact' },
      { path: '/careers/', href: '/career/' },
      { path: '/blog-archive/', href: '/blog/' },
    ];

    for (const { path, href } of collisions) {
      expect(
        isActive(path, href),
        `${path} is being marked as ${href}, so two things are true at once: ` +
          'the nav lights the wrong item, and it does it on a route nobody ' +
          'tested because it did not exist when the match was written',
      ).toBe(false);
    }
  });

  test('Home is the only route that is Home', () => {
    /*
     * Every path begins with `/`, so the root is the one href a prefix test
     * can never be used for. Separate from the collisions above because it is
     * a different failure: every route on the site at once, not a sibling.
     */
    for (const path of ['/about', '/blog/some-post', '/contact']) {
      expect(isActive(path, '/'), `${path} is being marked as Home`).toBe(
        false,
      );
    }

    expect(isActive('/', '/'), '/ is not marking itself as Home').toBe(true);
  });

  /**
   * The completeness guard ARCHITECTURE.md asks of a literal that stands in for the
   * build. `NAV_LINKS` is hand-written, so a link could point at a route this
   * site does not have and every assertion above would still pass: they ask
   * what the function says about a string, not whether the string resolves.
   */
  test('every navigation destination is a route this site builds', () => {
    const destinations = [...NAV_LINKS, CTA].map((link) => link.href);

    expect(
      destinations.length,
      'the navigation has no destinations at all, so the comparison below ' +
        'would pass by being empty',
    ).toBeGreaterThan(0);

    // ROUTES names pages without the trailing slash the hrefs carry.
    for (const href of destinations) {
      const route = href === HOME_HREF ? href : href.replace(/\/$/, '');
      expect(
        ROUTES,
        `the navigation points at ${href}, which the site does not build`,
      ).toContain(route);
    }
  });

  /*
   * The second tier. The question below is not what `isActive` returns but
   * whether all three navigations ask it about the call to action. Two did not.
   */
  test('/contact is marked as the current page in the header', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await gotoSettled(page, CTA.href);

    await expect(
      page.locator(HEADER_CTA),
      'the call to action does not announce itself as the current page on ' +
        'its own route, so /contact is the one page on this site where the ' +
        'header says nothing about where you are',
    ).toHaveAttribute('aria-current', 'page');
  });

  test('the current call to action is drawn as well as announced', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await gotoSettled(page, CTA.href);

    const cta = page.locator(HEADER_CTA);

    /*
     * `aria-current` covers the reader who is told; this covers the reader who
     * has to see it, which SC 1.4.1 asks to be a shape rather than a colour.
     * The ring is inset, so it changes nothing about the control's box, which
     * is why nothing else in the suite would notice it missing.
     */
    const shadow = await cta.evaluate(
      (element) => getComputedStyle(element).boxShadow,
    );

    expect(
      shadow,
      'the current call to action paints no ring, so the state reaches a ' +
        'screen reader and nobody else',
    ).not.toBe('none');
    expect(
      shadow,
      'the ring is not inset, so it is the hover shadow rather than the ' +
        'current-page ring',
    ).toContain('inset');
  });

  test('another route does not mark the call to action', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await gotoSettled(page, '/about');

    /*
     * The control the two above need. An assertion that something is marked
     * passes just as well against markup that marks everything.
     */
    await expect(
      page.locator(HEADER_CTA),
      'the call to action is marked current on a route that is not it',
    ).not.toHaveAttribute('aria-current', 'page');
  });

  /*
   * Home is not in the desktop nav: the logo before it already goes to `/`,
   * and the pair was two adjacent links to one URL. That leaves the logo as
   * the only thing in the desktop header that can say you are on the homepage,
   * so both halves are asserted together. If Home comes back to the nav, the
   * reason for marking the logo has gone with it.
   */
  test('the logo marks the homepage, which the desktop nav does not list', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await gotoSettled(page, HOME_HREF);

    await expect(
      page.locator(`${HEADER_NAV} a[href="${HOME_HREF}"]`),
      'the desktop nav lists Home again, directly after a logo link to the ' +
        'same URL',
    ).toHaveCount(0);

    await expect(
      page.locator(HEADER_LOGO),
      'on / nothing in the desktop header announces the current page',
    ).toHaveAttribute('aria-current', 'page');
  });

  test('another route does not mark the logo', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await gotoSettled(page, '/about');

    await expect(
      page.locator(HEADER_LOGO),
      'the logo is marked current on a route that is not the homepage',
    ).not.toHaveAttribute('aria-current', 'page');
  });

  test('the dialog and the fallback agree with the header', async ({
    browser,
  }) => {
    /*
     * The dialog is asserted in the DOM rather than opened: it is
     * server-rendered whole, and what is checked is the attribute the markup
     * carries, not the panel's behaviour, which tests/mobile-menu.spec.ts
     * walks.
     */
    const scripted = await browser.newContext({
      viewport: { width: 305, height: 800 },
    });

    try {
      const page = await scripted.newPage();
      await gotoSettled(page, CTA.href);

      await expect(
        page.locator(`#mobile-menu-panel a[href="${CTA.href}"]`),
        'the mobile dialog does not mark the call to action as the current ' +
          'page, so the header and the dialog disagree about the same route',
      ).toHaveAttribute('aria-current', 'page');
    } finally {
      await scripted.close();
    }

    const unscripted = await browser.newContext({
      javaScriptEnabled: false,
      viewport: { width: 305, height: 800 },
    });

    try {
      const page = await unscripted.newPage();
      await page.goto(CTA.href);

      await expect(
        page.locator(`nav.noscript-nav a[href="${CTA.href}"]`),
        'the no-JavaScript fallback does not mark the call to action as the ' +
          'current page. This is the one navigation that always did, and it ' +
          'is here so that bringing the other two into line cannot be done ' +
          'by taking it out of line.',
      ).toHaveAttribute('aria-current', 'page');
    } finally {
      await unscripted.close();
    }
  });
});
