import { test, expect, type Page } from './test';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { BLOG_CONTENT_DIR, DIST_DIR, TAG_ROUTES, builtHtml } from './routes';

/*
 * The feeds from src/lib/feed.ts: /rss.xml for every post, and one per tag
 * beside each tag listing. Parsed by the browser's XML parser, so a stray `&`
 * or an unclosed element fails here the way it would fail a feed reader or
 * Drupal Planet's strict parser, rather than passing a string match.
 *
 * Verified not to be vacuous, 2026-09-18: `rel="self"` changed to
 * `rel="alternate"` in src/lib/feed.ts fails both feed tests naming the feed,
 * and the `feed` prop dropped from the tag page fails the discovery test
 * naming each tag route. Restored, all three pass.
 */

const SITE = 'https://sinduri.lol';
const SITE_FEED = '/rss.xml';
const RFC_822 =
  /^(Mon|Tue|Wed|Thu|Fri|Sat|Sun), \d{2} (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{4} \d{2}:\d{2}:\d{2} \+0000$/;

interface PublishedPost {
  slug: string;
  date: string;
  tags: string[];
}

/** Non-placeholder posts from the Markdown, one frontmatter field per line. */
const publishedPosts = (): PublishedPost[] =>
  readdirSync(BLOG_CONTENT_DIR)
    .filter((name) => name.endsWith('.md'))
    .map((name) => {
      const source = readFileSync(join(BLOG_CONTENT_DIR, name), 'utf8');
      const field = (key: string): string =>
        new RegExp(`^${key}:\\s*(.+)$`, 'm').exec(source)?.[1]?.trim() ?? '';
      return {
        slug: name.replace(/\.md$/, ''),
        placeholder: field('placeholder'),
        date: field('date'),
        tags: [...field('tags').matchAll(/'([^']+)'/g)].map((m) => m[1]!),
      };
    })
    .filter((post) => post.placeholder !== 'true')
    .sort((a, b) => b.date.localeCompare(a.date));

interface ParsedFeed {
  error: string | null;
  version: string | null;
  title: string | null;
  link: string | null;
  description: string | null;
  self: string | null;
  items: { link: string; guid: string; pubDate: string; title: string }[];
}

const parseFeed = async (page: Page, path: string): Promise<ParsedFeed> => {
  const file = join(DIST_DIR, path);
  expect(existsSync(file), `${path} was not built`).toBe(true);
  const xml = readFileSync(file, 'utf8');
  await page.setContent('<!doctype html><title>feed</title>');
  return page.evaluate((text) => {
    const doc = new DOMParser().parseFromString(text, 'application/xml');
    const error = doc.querySelector('parsererror')?.textContent ?? null;
    const channel = doc.querySelector('rss > channel');
    const child = (name: string) =>
      channel?.querySelector(`:scope > ${name}`)?.textContent ?? null;
    const self = [
      ...(channel?.getElementsByTagNameNS(
        'http://www.w3.org/2005/Atom',
        'link',
      ) ?? []),
    ].find((link) => link.getAttribute('rel') === 'self');
    return {
      error,
      version: doc.documentElement.getAttribute('version'),
      title: child('title'),
      link: child('link'),
      description: child('description'),
      self: self?.getAttribute('href') ?? null,
      items: [...(channel?.querySelectorAll(':scope > item') ?? [])].map(
        (item) => ({
          link: item.querySelector('link')?.textContent ?? '',
          guid: item.querySelector('guid')?.textContent ?? '',
          pubDate: item.querySelector('pubDate')?.textContent ?? '',
          title: item.querySelector('title')?.textContent ?? '',
        }),
      ),
    };
  }, xml);
};

const postUrl = (slug: string): string => `${SITE}/blog/${slug}/`;

const expectValidFeed = (feed: ParsedFeed, path: string): void => {
  expect(feed.error, `${path} is not well-formed XML`).toBeNull();
  expect(feed.version, `${path} is not RSS 2.0`).toBe('2.0');
  expect(feed.title, `${path} has no channel title`).toBeTruthy();
  expect(feed.description, `${path} has no channel description`).toBeTruthy();
  expect(feed.link, `${path} channel link is not absolute`).toMatch(
    /^https:\/\//,
  );
  expect(
    feed.self,
    `${path} must name itself in atom:link rel="self", absolute`,
  ).toBe(`${SITE}${path}`);
  for (const item of feed.items) {
    expect(item.title, `an item in ${path} has no title`).toBeTruthy();
    expect(item.guid, `${item.link}: guid should be the permalink`).toBe(
      item.link,
    );
    expect(item.pubDate, `${item.link}: pubDate is not RFC 822`).toMatch(
      RFC_822,
    );
  }
};

test.describe('the feeds', () => {
  test('the site feed lists every published post, newest first', async ({
    page,
  }) => {
    const posts = publishedPosts();
    expect(
      posts.length,
      'no published posts were read, so this test would check nothing',
    ).toBeGreaterThan(0);

    const feed = await parseFeed(page, 'rss.xml');
    expectValidFeed(feed, SITE_FEED);
    expect(feed.items.map((item) => item.link)).toEqual(
      posts.map((post) => postUrl(post.slug)),
    );
  });

  test('every tag feed lists exactly the posts carrying that tag', async ({
    page,
  }) => {
    const posts = publishedPosts();
    for (const route of TAG_ROUTES) {
      const tag = route.split('/').pop()!;
      const path = `${route}/rss.xml`;
      const feed = await parseFeed(page, path.slice(1));
      expectValidFeed(feed, path);
      expect(
        feed.items.map((item) => item.link),
        `${path} should list the posts tagged ${tag}, newest first`,
      ).toEqual(
        posts
          .filter((post) => post.tags.includes(tag))
          .map((post) => postUrl(post.slug)),
      );
    }
  });

  test('every page advertises the site feed, and a tag page its own', () => {
    const pages = builtHtml();
    expect(pages.size, 'no built pages were read').toBeGreaterThan(0);
    const missing: string[] = [];
    for (const [route, html] of pages) {
      const feeds = [
        ...html.matchAll(
          /<link rel="alternate" type="application\/rss\+xml"[^>]*href="([^"]+)"/g,
        ),
      ].map((match) => match[1]);
      if (!feeds.includes(SITE_FEED)) missing.push(`${route}: ${SITE_FEED}`);
      if (route.startsWith('/blog/tag/')) {
        const own = `${route.replace(/\/$/, '')}/rss.xml`;
        if (!feeds.includes(own)) missing.push(`${route}: ${own}`);
      }
    }
    expect(
      missing,
      'a page does not carry the <link rel="alternate"> a feed reader uses to find the feed',
    ).toEqual([]);
  });
});
