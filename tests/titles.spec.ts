import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { builtPages, ROUTES } from './routes';

/**
 * SC 2.4.2 Page Titled, which axe checks the presence of and nothing more.
 *
 * `document-title` fires when a page has no <title> or an empty one. It says
 * nothing about whether two pages share a title, or whether a title says which
 * page you are on, and those are the failures that reach a reader: someone
 * with twelve tabs open, moving back through history, or listening to a window
 * list is served by the title being distinct and descriptive. The same site
 * name on every page satisfies axe and helps nobody.
 *
 * It reads dist/ rather than driving a browser, inside the test body only; see
 * tests/routes.ts.
 *
 * Proven able to fail, 2026-09-05: against a four-page fixture build, two
 * pages sharing a title, one with an empty <title>, one root, the three checks
 * report exactly the two shared routes, the one empty title and the one title
 * that does not match the pattern.
 *
 * The homepage is exempt from the separator rule. It titles itself with
 * Sinduri's name and her tagline, because the name is what people search for.
 * It still has to be unique and non-empty.
 *
 * Casing is deliberately not asserted. The category pages title themselves in
 * lower case, because the category segment comes through from the content as
 * authored. That inconsistency is recorded in TODO.md; normalising it is a
 * content decision, and it fails nothing in SC 2.4.2.
 */
const SITE = 'sinduri.lol';

/** Mirrors the title in src/pages/index.astro. */
const ROOT_TITLE =
  'Sinduri Guntupalli | Open Source Enthusiast, Positivity Advocate';

/**
 * The document title, read out of built HTML. Matched directly: the build
 * carries no authored comments (tests/seo.spec.ts), so no comment can mention
 * `<title>` ahead of the real tag. One did, and every route's title came back
 * as a paragraph of comment prose.
 */
const titleOf = (html: string): string | null => {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match ? match[1].trim() : null;
};

const builtTitles = (): Map<string, string | null> => {
  const pages = builtPages();
  return new Map(
    pages.map((page) => [page.route, titleOf(readFileSync(page.file, 'utf8'))]),
  );
};

test.describe('every page says which page it is', () => {
  test('every route has a non-empty title', () => {
    const titles = builtTitles();
    const missing = ROUTES.filter((route) => {
      const title = titles.get(route);
      return !title || title.length === 0;
    });
    expect(
      missing,
      `route(s) built with no <title> or an empty one: ${missing.join(', ')}`,
    ).toEqual([]);
  });

  test('no two routes share a title', () => {
    const titles = builtTitles();
    const byTitle = new Map<string, string[]>();
    for (const [route, title] of titles) {
      if (title === null) continue;
      byTitle.set(title, [...(byTitle.get(title) ?? []), route]);
    }

    const shared = [...byTitle.entries()].filter(
      ([, routes]) => routes.length > 1,
    );
    expect(
      shared,
      `title(s) used by more than one route, which leaves a reader with two ` +
        `identical tabs and no way to tell them apart (SC 2.4.2):\n` +
        shared
          .map(
            ([title, routes]) =>
              `  ${JSON.stringify(title)} — ${routes.join(', ')}`,
          )
          .join('\n'),
    ).toEqual([]);
  });

  /*
   * One test over every route rather than one test per route.
   *
   * These are string checks on built HTML, so there is nothing per-route to
   * isolate: no browser, no navigation, nothing that can crash and take the
   * rest with it. `expect.soft` reports every failing route in one run instead
   * of stopping at the first.
   *
   * The `checked` count is the floor. Comparing an empty list against an empty
   * list passes, so without it a change that made `ROUTES` or `builtTitles()`
   * return nothing would leave this green while checking nothing.
   */
  test('every route names itself and the site', () => {
    const titles = builtTitles();
    const checked: string[] = [];

    for (const route of ROUTES) {
      const title = titles.get(route);
      expect(title, `${route} was not found in the build`).toBeTruthy();
      checked.push(route);

      if (route === '/') {
        expect
          .soft(
            title,
            `the site root should title itself with the bare site name`,
          )
          .toBe(ROOT_TITLE);
        continue;
      }

      expect
        .soft(
          title,
          `${route} should title itself "<page> | ${SITE}" so the page is ` +
            `named before the site. Got ${JSON.stringify(title)}.`,
        )
        .toMatch(new RegExp(`^.+ \\| ${SITE.replace('.', '\\.')}$`));

      const named = title!.slice(0, title!.lastIndexOf(` | ${SITE}`)).trim();
      expect
        .soft(
          named.length,
          `${route} has an empty page part before the separator`,
        )
        .toBeGreaterThan(0);
      expect
        .soft(named, `${route} names the site twice and the page not at all`)
        .not.toBe(SITE);
    }

    expect(
      checked,
      'the per-route title check visited a different set of routes than ' +
        'ROUTES. It passes vacuously if that list is ever empty.',
    ).toEqual([...ROUTES]);
  });
});
