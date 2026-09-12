import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { builtHtml, DIST_DIR, ROUTES } from './routes';
import { GLOBAL_CSS, cssColorToken } from './source';

/**
 * The document head, for the parts of it no rule engine and no other spec
 * covers.
 *
 * `tests/titles.spec.ts` owns <title>. This file owns the two colour-scheme
 * declarations, which nothing else in the suite would notice the loss of,
 * because neither changes a single pixel a Playwright screenshot can see. They
 * change what the *user agent* paints around and inside the page: the
 * scrollbar, unstyled form controls, the selection highlight, and the
 * address-bar tint on Android.
 *
 * Why it reads dist/ and not the browser: both values are static bytes in the
 * served HTML and neither needs rendering, so loading every page would buy
 * nothing. tests/titles.spec.ts, tests/headers.spec.ts and
 * tests/not-found.spec.ts read the build for the same reason. The read happens
 * inside each test body, never at module scope: Playwright collects test files
 * before the `webServer` command runs, so a module-scope read would see a
 * stale or absent dist/. That is the trap tests/routes.ts documents for ROUTES.
 *
 * The theme colour is not written down here. It is read out of
 * src/styles/global.css, the same way BaseLayout.astro reads it, and the two
 * are compared. Copying `#131313` into this file would make the assertion
 * agree with a stale value rather than with the design, which is the
 * duplicated-fact failure ARCHITECTURE.md > Conventions > Tests warns about. The check
 * is that the served markup names the *current* value of --color-background.
 *
 * Verified 2026-09-07, against the build as committed:
 *
 *   - deleting `<meta name="color-scheme">` from BaseLayout fails
 *     "declares the dark colour scheme" on every route;
 *   - deleting the `color-scheme: dark` declaration from global.css fails
 *     "the stylesheet declares the scheme too", and nothing else, which is
 *     the point of that test existing separately;
 *   - changing --color-background in global.css and rebuilding passes, because
 *     the tag follows the token by construction; hardcoding a different hex
 *     into the meta tag instead fails "tints the browser chrome with the
 *     background token" on every route.
 *
 * That last pair is the one worth reading twice. The test cannot fail while
 * the layout derives the value, and it is here for the day somebody decides
 * the derivation is too clever and types the hex in.
 */

const metaContent = (html: string, name: string): string | null => {
  /*
   * Attribute order is not guaranteed, so both orders are matched rather than
   * assuming the one Astro happens to emit today. A tag with no `content` is
   * a distinct failure from a tag that is absent, and this returns null for
   * the second and '' for the first, so the assertions can tell them apart.
   */
  const escaped = name.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
  const forward = new RegExp(
    `<meta[^>]*\\sname=["']${escaped}["'][^>]*\\scontent=["']([^"']*)["']`,
    'i',
  );
  const reverse = new RegExp(
    `<meta[^>]*\\scontent=["']([^"']*)["'][^>]*\\sname=["']${escaped}["']`,
    'i',
  );

  const match = forward.exec(html) ?? reverse.exec(html);
  return match ? match[1] : null;
};

test.describe('the font the first paint needs is preloaded', () => {
  /**
   * The two ways a font preload goes wrong, both silent.
   *
   * A preload pointing at a path that no longer exists is a 404 the page
   * ignores: the font still loads later from the stylesheet, so nothing looks
   * broken and the preload simply does nothing. The href is derived from a
   * `?url` import so it cannot rot, and this asserts the file is really there.
   *
   * A preload WITHOUT `crossorigin` is worse, and is the classic version of
   * this mistake. Fonts are fetched in CORS mode, so an anonymous preload is a
   * different request from the one the @font-face rule later makes: the
   * browser downloads the file twice and uses the second. That is slower than
   * having no preload, and the only symptom is a duplicate row in a network
   * panel nobody is looking at.
   *
   * Verified 2026-09-09: dropping `crossorigin` fails the CORS-mode assertion
   * on all 25 routes; pointing the href at a literal path instead of the
   * import fails the file-exists assertion as soon as the font package
   * changes, and immediately if the hash is mistyped.
   */
  /*
   * One test over every route. String checks on built HTML, so nothing here
   * needs per-route isolation; `expect.soft` names every failing route in one
   * run, and `checked` is the floor against a vacuous pass.
   */
  test('every route preloads exactly one font, correctly', () => {
    const pages = builtHtml();
    const checked: string[] = [];

    for (const route of ROUTES) {
      const html = pages.get(route);
      expect(html, `${route} was not found in the build`).toBeTruthy();
      checked.push(route);

      const preloads = [
        ...html!.matchAll(/<link[^>]*rel=["']preload["'][^>]*>/gi),
      ].map((match) => match[0]);

      const fonts = preloads.filter((tag) => /as=["']font["']/i.test(tag));

      /*
       * Exactly one, and it is the only subset the build ships: global.css
       * declares the latin @font-face and nothing imports the package's CSS,
       * which would emit latin-ext and vietnamese as well.
       */
      expect
        .soft(
          fonts.length,
          `${route} preloads ${fonts.length} fonts. It should preload one: ` +
            'the latin subset, which is the only one the build emits.',
        )
        .toBe(1);

      if (fonts.length !== 1) continue;

      const href = /href=["']([^"']+)["']/i.exec(fonts[0]!)?.[1];
      expect
        .soft(href, `${route} has a font preload with no href`)
        .toBeTruthy();

      if (href) {
        expect
          .soft(
            existsSync(join(DIST_DIR, href.replace(/^\//, ''))),
            `${route} preloads ${href}, which the build did not emit. The ` +
              'href comes from a `?url` import so it should track the hashed ' +
              'filename; a literal path here would rot on the next font ' +
              'package update.',
          )
          .toBe(true);
      }

      expect
        .soft(
          /\bcrossorigin\b/i.test(fonts[0]!),
          `${route} preloads a font without \`crossorigin\`. Fonts are ` +
            'fetched in CORS mode, so this preload is a different request ' +
            'from the one the @font-face rule makes: the browser fetches the ' +
            'file twice and uses the second. Slower than no preload at all.',
        )
        .toBe(true);
    }

    expect(
      checked,
      'the per-route walk visited a different set of routes than ROUTES. It ' +
        'passes vacuously if that list is ever empty.',
    ).toEqual([...ROUTES]);
  });
});

test.describe('the document head declares the colour scheme', () => {
  test('the stylesheet declares the scheme too', () => {
    /*
     * The meta tag and this declaration are not redundant. The meta applies
     * while the parser is still in <head>, before the stylesheet request has
     * come back, which is when the scrollbar is first painted; the stylesheet
     * declaration survives the meta being dropped. Losing either one is a
     * real regression, so each is asserted on its own.
     */
    const css = readFileSync(GLOBAL_CSS, 'utf8');

    expect(
      css,
      `${GLOBAL_CSS} should declare \`color-scheme: dark\` on html, so the ` +
        'user agent paints its own widgets dark even if the meta tag is lost.',
    ).toMatch(/color-scheme:\s*dark\s*;/);

    /*
     * `dark light` would advertise a light theme this design does not have:
     * there are no light tokens and every ratio in that file is measured
     * against a dark ground. See the declaration's own comment.
     */
    expect(
      css,
      `${GLOBAL_CSS} should not advertise a light scheme. There are no light ` +
        'tokens, so a light-preferring reader would get UA widgets painted ' +
        'for a ground this design never renders.',
    ).not.toMatch(/color-scheme:[^;]*\blight\b/);
  });

  /*
   * One test over every route. These are string checks on built HTML, so there
   * is nothing per-route to isolate, and `expect.soft` names every failing
   * route in one run. The `checked` count is the floor: comparing two empty
   * lists passes, so without it an empty ROUTES would leave this green.
   */
  test('every route declares the dark colour scheme', () => {
    const pages = builtHtml();
    const checked: string[] = [];

    for (const route of ROUTES) {
      const html = pages.get(route);
      expect(html, `${route} was not found in the build`).toBeTruthy();
      checked.push(route);

      expect
        .soft(
          metaContent(html!, 'color-scheme'),
          `${route} should carry <meta name="color-scheme" content="dark">, ` +
            'so the scrollbar and any unstyled control are painted dark from ' +
            'the first byte rather than from the stylesheet.',
        )
        .toBe('dark');
    }

    expect(
      checked,
      'the per-route walk visited a different set of routes than ROUTES. It ' +
        'passes vacuously if that list is ever empty.',
    ).toEqual([...ROUTES]);
  });

  test('every route tints the browser chrome with the background token', () => {
    const pages = builtHtml();
    const background = cssColorToken('--color-background');
    const checked: string[] = [];

    for (const route of ROUTES) {
      const html = pages.get(route);
      expect(html, `${route} was not found in the build`).toBeTruthy();
      checked.push(route);

      const themeColor = metaContent(html!, 'theme-color');
      expect
        .soft(themeColor, `${route} should carry <meta name="theme-color">.`)
        .not.toBeNull();

      expect
        .soft(
          themeColor?.toLowerCase(),
          `${route} tints the browser chrome a colour that is not the site ` +
            `background. The tag should carry --color-background from ` +
            `${GLOBAL_CSS}; BaseLayout.astro reads it out of that file so the ` +
            'two cannot drift.',
        )
        .toBe(background);
    }

    expect(
      checked,
      'the per-route walk visited a different set of routes than ROUTES. It ' +
        'passes vacuously if that list is ever empty.',
    ).toEqual([...ROUTES]);
  });
});
