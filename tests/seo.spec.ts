import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { builtHtml as builtHtmlByRoute, DIST_DIR, TAG_ROUTES } from './routes';

const SITE_ORIGIN = 'https://sinduri.lol';

/**
 * What a crawler or a link unfurler reads from the built HTML.
 *
 * Reads dist/ inside each test, never at module scope: Playwright collects
 * this file before the webServer command builds the site. The HTML is read
 * raw; 'built HTML' below keeps authored comments out of it.
 */
const builtHtml = (): { route: string; html: string }[] =>
  [...builtHtmlByRoute()].map(([route, html]) => ({ route, html }));

/**
 * The only comments the build may emit: Vue's fragment and empty-node markers,
 * which hydration needs, and Astro's island end marker.
 */
const FRAMEWORK_COMMENTS = new Set([
  '<!--[-->',
  '<!--]-->',
  '<!---->',
  '<!--astro:end-->',
]);
const SHOWN_COMMENTS = 10;
const COMMENT_PREVIEW_CHARS = 60;

test.describe('built HTML', () => {
  /*
   * Authored <!-- --> comments in .astro templates are emitted verbatim, and
   * were 43.8% of the built HTML (2026-09-11). Templates use JSX-style
   * comments, which Astro does not emit.
   *
   * Verified 2026-09-11: with the old comments restored in the 13 templates
   * this fails with 782 authored comments in the build.
   */
  test('carries no authored HTML comments', () => {
    const comments = builtHtml().flatMap(({ route, html }) =>
      (html.match(/<!--[\s\S]*?-->/g) ?? []).map((comment) => ({
        route,
        comment,
      })),
    );
    expect(
      comments.length,
      'no comments found at all, so the scan is not reading the build',
    ).toBeGreaterThan(0);

    const authored = comments.filter(
      ({ comment }) => !FRAMEWORK_COMMENTS.has(comment),
    );
    expect(
      authored
        .slice(0, SHOWN_COMMENTS)
        .map(
          ({ route, comment }) =>
            `${route}: ${comment.slice(0, COMMENT_PREVIEW_CHARS)}`,
        ),
      `${authored.length} authored comment(s) in the build, first ${SHOWN_COMMENTS} shown`,
    ).toEqual([]);
  });
});

const HEADING = /<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi;

test.describe('headings', () => {
  /*
   * A <br> splits a heading visually but not in its text, so the text a
   * crawler or screen reader gets runs the lines together
   * ("Enthusiast.Positivity"). Use block spans.
   *
   * Verified 2026-09-11: with the <br> restored on /career this fails on
   * "/career h2".
   */
  test('no heading is split with <br>', () => {
    const headings = builtHtml().flatMap(({ route, html }) =>
      [...html.matchAll(HEADING)].map(([, level, inner]) => ({
        name: `${route} h${level}`,
        inner: inner ?? '',
      })),
    );

    expect(headings.length, 'no headings found in the build').toBeGreaterThan(
      0,
    );
    expect(
      headings.filter(({ inner }) => /<br\b/i.test(inner)).map((h) => h.name),
      'heading(s) split with <br>',
    ).toEqual([]);
  });
});

/** Open Graph and Twitter tags every page needs for a full link preview. */
const LINK_PREVIEW_TAGS = [
  'og:type',
  'og:site_name',
  'og:title',
  'og:description',
  'og:url',
  'og:locale',
  'og:image',
  'og:image:width',
  'og:image:height',
  'og:image:alt',
  'twitter:card',
  'twitter:title',
  'twitter:description',
  'twitter:image',
  'twitter:image:alt',
] as const;

/** A meta tag's content by `property` or `name`; null when the tag is absent. */
const metaContent = (html: string, key: string): string | null => {
  const escaped = key.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
  const keyAttr = new RegExp(`\\s(?:property|name)=["']${escaped}["']`, 'i');
  const tag = html.match(/<meta\b[^>]*>/gi)?.find((t) => keyAttr.test(t));
  if (!tag) return null;
  return /\scontent=["']([^"']*)["']/i.exec(tag)?.[1] ?? '';
};

const PNG_SIGNATURE = '89504e470d0a1a0a';
const PNG_WIDTH_OFFSET = 16;
const PNG_HEIGHT_OFFSET = 20;

test.describe('link previews', () => {
  /*
   * Verified 2026-09-11: before BaseLayout emitted the locale, image size and
   * image alt, this failed on all 25 routes for those five tags.
   */
  test('every page carries every link-preview tag', () => {
    const pages = builtHtml();
    expect(pages.length, 'no pages found in the build').toBeGreaterThan(0);

    const missing = pages.flatMap(({ route, html }) =>
      LINK_PREVIEW_TAGS.filter((key) => !metaContent(html, key)).map(
        (key) => `${route} ${key}`,
      ),
    );
    expect(missing, 'missing or empty link-preview tag(s)').toEqual([]);
  });

  test('every og:image is the size it declares', () => {
    const wrong = builtHtml().flatMap(({ route, html }) => {
      const url = metaContent(html, 'og:image');
      if (!url) return [];
      const bytes = readFileSync(join(DIST_DIR, new URL(url).pathname));
      if (bytes.subarray(0, 8).toString('hex') !== PNG_SIGNATURE) {
        return [`${route}: ${url} is not a PNG`];
      }
      const actual = `${bytes.readUInt32BE(PNG_WIDTH_OFFSET)}x${bytes.readUInt32BE(PNG_HEIGHT_OFFSET)}`;
      const declared = `${metaContent(html, 'og:image:width')}x${metaContent(html, 'og:image:height')}`;
      return actual === declared
        ? []
        : [`${route}: declares ${declared}, ${url} is ${actual}`];
    });
    expect(wrong, 'og:image size mismatch(es)').toEqual([]);
  });
});

/**
 * Same-origin page links from <a href>: root-relative or on SITE_ORIGIN, with
 * any query or fragment dropped. Files (a dot in the last segment) are skipped.
 */
const internalPageLinks = (html: string): string[] =>
  [...html.matchAll(/<a\b[^>]*\shref=["']([^"']*)["']/gi)]
    .map(([, href]) => (href ?? '').split(/[?#]/)[0] ?? '')
    .map((href) =>
      href.startsWith(SITE_ORIGIN)
        ? href.slice(SITE_ORIGIN.length) || '/'
        : href,
    )
    .filter((href) => href.startsWith('/') && !href.startsWith('//'))
    .filter((href) => !(href.split('/').pop() ?? '').includes('.'));

test.describe('internal links', () => {
  /*
   * Every page is built as <route>/index.html, so production answers a link
   * without its trailing slash with a 307 to the slashed URL. A browser test
   * follows that redirect without failing, so this reads the hrefs instead.
   *
   * Verified 2026-09-11: against the hrefs before the slashes were added this
   * failed with 23 distinct unslashed hrefs across 520 links.
   */
  test('every internal page link ends with a slash', () => {
    const links = builtHtml().flatMap(({ route, html }) =>
      internalPageLinks(html).map((href) => ({ route, href })),
    );
    expect(links.length, 'no internal page links found').toBeGreaterThan(0);

    const unslashed = new Map<string, number>();
    for (const { href } of links.filter(({ href }) => !href.endsWith('/'))) {
      unslashed.set(href, (unslashed.get(href) ?? 0) + 1);
    }
    expect(
      [...unslashed].map(([href, count]) => `${href} (${count} links)`),
      'internal link(s) without a trailing slash, each a 308 in production',
    ).toEqual([]);
  });
});

/**
 * What a search result shows: the title and the description, per route.
 *
 * Length is asserted only where it changes what a reader sees. A description
 * past 160 characters is cut mid-sentence in a result; one under 50 is usually
 * replaced by text the engine picks out of the page, so the page stops
 * describing itself. Titles past 70 are cut the same way.
 *
 * Two kinds of page are exempt from the floor, and both are pages no search
 * result shows: the tag listings carry `noindex`, and the two contact routes
 * are kept out of the sitemap. Their descriptions are short because there is
 * nothing more to say, not because they are unfinished.
 *
 * Proven able to fail, 2026-09-18: with the category descriptions back at
 * `Posts filed under ${label}.` all five failed the 50-character floor, and
 * the uniqueness check is what "Posts filed under Travel." would not trip on
 * its own.
 */
test.describe('search results', () => {
  const MIN_DESCRIPTION = 50;
  const MAX_DESCRIPTION = 160;
  const MAX_TITLE = 70;

  const UNLISTED = [
    '/404',
    '/contact/sent',
    ...TAG_ROUTES.map((route) => route),
  ];

  test('every route describes itself in its own words', () => {
    const short: string[] = [];
    const long: string[] = [];
    const missing: string[] = [];
    const byDescription = new Map<string, string[]>();

    for (const { route, html } of builtHtml()) {
      const description = metaContent(html, 'description');

      if (description === null || description === '') {
        missing.push(route);
        continue;
      }

      byDescription.set(description, [
        ...(byDescription.get(description) ?? []),
        route,
      ]);

      if (description.length > MAX_DESCRIPTION) {
        long.push(`${route} (${description.length})`);
      }
      if (
        description.length < MIN_DESCRIPTION &&
        !UNLISTED.includes(route.replace(/\/$/, ''))
      ) {
        short.push(`${route} (${description.length})`);
      }
    }

    expect(missing, 'route(s) with no description').toEqual([]);
    expect(
      long,
      `description(s) over ${MAX_DESCRIPTION} characters, cut mid-sentence ` +
        'in a search result',
    ).toEqual([]);
    expect(
      short,
      `description(s) under ${MIN_DESCRIPTION} characters, which a search ` +
        'engine tends to replace with text of its own choosing',
    ).toEqual([]);

    const shared = [...byDescription].filter(([, routes]) => routes.length > 1);
    expect(
      shared.map(
        ([description, routes]) => `${routes.join(', ')}: ${description}`,
      ),
      'route(s) sharing a description, which makes two results look like the ' +
        'same page',
    ).toEqual([]);
  });

  test('no title is long enough to be cut in a result', () => {
    const long = builtHtml()
      .map(({ route, html }) => ({
        route,
        title: /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1] ?? '',
      }))
      .filter(({ title }) => title.length > MAX_TITLE)
      .map(({ route, title }) => `${route} (${title.length})`);

    expect(long, `title(s) over ${MAX_TITLE} characters`).toEqual([]);
  });
});
