import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { builtPages, ROUTES } from './routes';

/**
 * SC 2.4.2 Page Titled, which axe checks the presence of and nothing more.
 *
 * `document-title` fires when a page has no <title> or an empty one. It has
 * nothing to say about whether two pages share a title, or whether a title
 * says which page you are on — and those are the failures that actually reach
 * a reader. Someone with twelve tabs open, or moving back through history, or
 * listening to a window list, is served by the title being *distinct* and
 * *descriptive*; "sinduri.lol" twenty-three times satisfies axe and helps
 * nobody.
 *
 * The Accessible Astro checklist puts this as "are page titles descriptive
 * (e.g. Page Name - Site Name)", and specification.website has the same item
 * under SEO. Both are right about the shape, and neither is a rule engine, so
 * this is the assertion.
 *
 * WHY IT READS dist/ AND NOT THE BROWSER. The title is in the served HTML and
 * needs no rendering, so 23 page loads would buy nothing. tests/headers.spec.ts
 * and tests/not-found.spec.ts read the build for the same reason. The read
 * happens inside the test body rather than at module scope: Playwright
 * collects test files before the `webServer` command runs, so a module-scope
 * read would see a stale or absent dist/ and generate the wrong tests. That is
 * the same trap tests/routes.ts documents for ROUTES.
 *
 * VERIFIED ABLE TO FAIL. Run against a four-page fixture build — two pages
 * sharing "Shared | sinduri.lol", one with an empty <title>, one root — the
 * three checks report exactly the two shared routes, the one empty title and
 * the one title that does not match the pattern. Measured 2026-09-05.
 *
 * THE HOMEPAGE IS DELIBERATELY EXEMPT from the separator rule. Its title is
 * the bare site name, which is the convention for a site root and is what the
 * build produces. It still has to be unique, and it still has to be non-empty.
 *
 * WHAT THIS DOES NOT ASSERT, AND WHY. Casing. Five category pages title
 * themselves in lower case — "skincare | sinduri.lol", "open source |
 * sinduri.lol" — against "Blog | sinduri.lol" and "Career | sinduri.lol",
 * because the category segment comes through from the content as authored.
 * That is an inconsistency and it is recorded in TODO.md, but normalising it
 * is a content decision and not one a test should make by fiat. Nothing about
 * it fails SC 2.4.2: the titles are still distinct and still descriptive.
 */
const SITE = 'sinduri.lol';

/** The site root titles itself with the bare site name. */
const ROOT_TITLE = SITE;

const titleOf = (html: string): string | null => {
  const match = html.match(/<title>([\s\S]*?)<\/title>/i);
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

  for (const route of ROUTES) {
    test(`${route} names itself and the site`, () => {
      const title = builtTitles().get(route);
      expect(title, `${route} was not found in the build`).toBeTruthy();

      if (route === '/') {
        expect(
          title,
          `the site root should title itself with the bare site name`,
        ).toBe(ROOT_TITLE);
        return;
      }

      expect(
        title,
        `${route} should title itself "<page> | ${SITE}" so the page is named ` +
          `before the site. Got ${JSON.stringify(title)}.`,
      ).toMatch(new RegExp(`^.+ \\| ${SITE.replace('.', '\\.')}$`));

      const page = title!.slice(0, title!.lastIndexOf(` | ${SITE}`)).trim();
      expect(
        page.length,
        `${route} has an empty page part before the separator`,
      ).toBeGreaterThan(0);
      expect(
        page,
        `${route} names the site twice and the page not at all`,
      ).not.toBe(SITE);
    });
  }
});
