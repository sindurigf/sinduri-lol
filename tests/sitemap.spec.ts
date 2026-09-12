import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { builtPages, DIST_DIR, routesFromBuild } from './routes';
import { configuredSite } from './source';

/**
 * robots.txt, the sitemap, and the three places that have to agree on where
 * the sitemap is.
 *
 * Two failures worth a test, both quiet:
 *
 *   1. A new page never reaches the sitemap, or an entry outlives the page it
 *      names. The site works either way, and the only symptom is a URL a
 *      crawler never hears about, or one it is invited to fetch and served a
 *      404 for. The assertion is against `routesFromBuild`, which reads dist/
 *      rather than a list in a file.
 *
 *   2. The name drifts. @astrojs/sitemap emits `sitemap-index.xml` plus a
 *      numbered `sitemap-0.xml`, never a bare `sitemap.xml`, and the obvious
 *      name gets typed into robots.txt from memory. A `Sitemap:` line pointing
 *      at a URL that 404s is not an error anywhere: the crawler asks once and
 *      moves on. Three places name that file, the `Sitemap:` line, the `<link
 *      rel="sitemap">` on every page and the build output, and this checks all
 *      three against each other rather than against a constant typed here.
 *
 * It reads dist/ rather than driving a browser, inside test bodies only; see
 * tests/routes.ts. The origin comes from `site` in astro.config.mjs, the value
 * the integration wrote the entries with.
 *
 * Proven able to fail, 2026-09-09:
 *
 *   - robots.txt pointed at `/sitemap.xml` fails "robots.txt points at a
 *     sitemap that exists" and "all three agree on the sitemap URL";
 *   - the same change to the `<link rel="sitemap">` fails the second, on every
 *     route;
 *   - `customPages: ['https://sinduri.lol/404/']` added to the integration
 *     fails "the sitemap lists every page and only pages" and "the error page
 *     is not advertised", the intended overlap: the first names the surplus
 *     URL, the second the reason it matters.
 *
 * That last mutation is artificial because nothing here implements the
 * exclusion. @astrojs/sitemap drops status-code pages itself, before any
 * filter runs, so `the error page is not advertised` guards a dependency's
 * behaviour rather than a decision made in this repository.
 */

const ROBOTS_FILE = join(DIST_DIR, 'robots.txt');

/**
 * The sitemap @astrojs/sitemap actually writes. An index plus one numbered
 * file is its output shape for any project, not a setting, so this is the
 * name every other reference has to match.
 */
const SITEMAP_PATH = '/sitemap-index.xml';

/**
 * The route the build emits that must not be advertised. Kept out by
 * @astrojs/sitemap's own `STATUS_CODE_PAGES` set, not by anything here.
 */
/*
 * Built, and deliberately not advertised. `/404` is dropped by the integration
 * itself; `/contact/sent` is dropped by the filter in astro.config.mjs,
 * because a crawler served a confirmation reads that a message it never sent
 * was received.
 */
const EXCLUDED_ROUTES = ['/404', '/contact/sent'];
const EXCLUDED_ROUTE = EXCLUDED_ROUTES[0]!;

/** Every `<loc>` in the built sitemap, as pathnames, sorted. */
const sitemapPaths = (origin: string): string[] => {
  const index = join(DIST_DIR, SITEMAP_PATH.slice(1));
  expect(
    existsSync(index),
    `${index} was not built. @astrojs/sitemap runs as part of \`astro ` +
      'build\`; if the integration was removed, robots.txt and the ' +
      '<link rel="sitemap"> both now point at nothing.',
  ).toBe(true);

  /*
   * The index names the numbered files; the URLs live in those. Following it
   * rather than reading `sitemap-0.xml` directly keeps this working on the day
   * the site outgrows one file, which is why the index exists.
   */
  const indexXml = readFileSync(index, 'utf8');
  const parts = [...indexXml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(
    (match) => match[1]!,
  );

  expect(parts.length, `${index} names no sitemap files`).toBeGreaterThan(0);

  const paths: string[] = [];

  for (const part of parts) {
    const file = join(DIST_DIR, new URL(part).pathname.slice(1));
    expect(
      existsSync(file),
      `the sitemap index names ${part}, which the build did not write`,
    ).toBe(true);

    for (const match of readFileSync(file, 'utf8').matchAll(
      /<loc>([^<]+)<\/loc>/g,
    )) {
      const loc = match[1]!;

      expect(
        loc.startsWith(`${origin}/`),
        `${loc} is not under the configured site origin ${origin}. A ` +
          'sitemap entry has to be an absolute URL on the site it describes.',
      ).toBe(true);

      paths.push(new URL(loc).pathname);
    }
  }

  return paths.sort();
};

/** Routes as the sitemap spells them: with a trailing slash, bar the root. */
const asSitemapPath = (route: string): string =>
  route === '/' ? '/' : `${route}/`;

test.describe('robots.txt and the sitemap', () => {
  test('robots.txt points at a sitemap that exists', () => {
    expect(
      existsSync(ROBOTS_FILE),
      `${ROBOTS_FILE} was not built. It is generated by ` +
        'src/pages/robots.txt.ts, not served from public/.',
    ).toBe(true);

    const robots = readFileSync(ROBOTS_FILE, 'utf8');
    const origin = configuredSite();

    expect(
      robots,
      'robots.txt should allow crawling. It is a public site with nothing ' +
        'to hide from an index.',
    ).toMatch(/^User-agent:\s*\*$/m);

    const sitemapLine = /^Sitemap:\s*(\S+)$/m.exec(robots);
    expect(
      sitemapLine,
      'robots.txt has no Sitemap line, which is the one thing in the file ' +
        'that is doing any work here.',
    ).not.toBeNull();

    const declared = sitemapLine![1]!;

    /*
     * Absolute, not relative. robots.txt gives a Sitemap line no base to
     * resolve against, so `/sitemap-index.xml` there is not a relative URL,
     * it is a line crawlers skip without reporting anything.
     */
    expect(
      declared,
      `the Sitemap line reads "${declared}". It has to be an absolute URL: ` +
        'the format gives it no base to resolve a path against, so a ' +
        'relative one is silently ignored rather than resolved.',
    ).toBe(`${origin}${SITEMAP_PATH}`);

    expect(
      existsSync(join(DIST_DIR, SITEMAP_PATH.slice(1))),
      `robots.txt advertises ${declared}, which the build did not write.`,
    ).toBe(true);
  });

  test('all three agree on the sitemap URL', () => {
    const robots = readFileSync(ROBOTS_FILE, 'utf8');
    const declared = /^Sitemap:\s*(\S+)$/m.exec(robots)?.[1] ?? '';

    expect(
      new URL(declared).pathname,
      'robots.txt and the build disagree about where the sitemap is',
    ).toBe(SITEMAP_PATH);

    /*
     * Every page, not a sample. The <link> comes from BaseLayout, so a route
     * that stopped using the layout is exactly the page that would lose it.
     */
    for (const page of builtPages()) {
      const html = readFileSync(page.file, 'utf8');
      const link = /<link[^>]*rel=["']sitemap["'][^>]*>/i.exec(html);

      expect(
        link,
        `${page.route} carries no <link rel="sitemap">. Every page gets one ` +
          'from BaseLayout; a route without it has stopped using the layout.',
      ).not.toBeNull();

      const href = /href=["']([^"']+)["']/i.exec(link![0])?.[1];
      expect(
        href,
        `${page.route} points its sitemap link at ${href} while robots.txt ` +
          `and the build both say ${SITEMAP_PATH}.`,
      ).toBe(SITEMAP_PATH);
    }
  });

  test('the sitemap lists every page and only pages', () => {
    const origin = configuredSite();
    const listed = sitemapPaths(origin);

    /*
     * `routesFromBuild` reads dist/, so this compares the sitemap against what
     * the build emitted rather than a list anybody has to remember to update.
     */
    const expected = routesFromBuild()
      .filter((route) => !EXCLUDED_ROUTES.includes(route))
      .map(asSitemapPath)
      .sort();

    expect(
      listed,
      'the sitemap and the build have drifted. A URL listed here and not ' +
        'built is one a crawler will be served a 404 for; a page built and ' +
        'not listed is one it may never hear about.',
    ).toEqual(expected);
  });

  test('the error page is not advertised', () => {
    const origin = configuredSite();
    const listed = sitemapPaths(origin);

    /*
     * Separate from the comparison above, which would also catch this but
     * fails with a diff of two long lists. A sitemap is a list of URLs a
     * crawler is asked to index, and Cloudflare serves this page's body as the
     * 404 for every wrong address, so the one path where it is reachable with
     * a 200 is the one place it should never be advertised.
     *
     * @astrojs/sitemap drops status-code pages itself, so this asserts a
     * dependency keeps doing something it is not obliged to keep doing. A
     * version bump is how that would change, and a sitemap that gained an
     * error page is not a failure anything else would notice.
     */
    for (const path of listed) {
      expect(
        path.replace(/\/$/, ''),
        `the sitemap advertises ${path}. @astrojs/sitemap drops status-code ` +
          'pages itself, with no filter in astro.config.mjs, so it has ' +
          'stopped doing that.',
      ).not.toBe(EXCLUDED_ROUTE);
    }
  });
});
