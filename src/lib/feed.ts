import type { BlogPost } from './blog';

/*
 * RSS 2.0, hand-written rather than through @astrojs/rss: a feed is one small
 * XML document, and the other generated files here (llms.txt, robots.txt, the
 * manifest) are plain endpoints the same way.
 *
 * Shaped by the RSS Best Practices Profile (rssboard.org/rss-profile): an
 * `atom:link rel="self"`, RFC 822 dates, and a permalink `guid`. Drupal Planet
 * reads feeds with a strict parser and asks that they pass the W3C validator,
 * which is what the per-tag feeds are for: /blog/tag/drupal/rss.xml is the
 * Drupal-only feed Planet wants. tests/rss.spec.ts parses the output.
 *
 * Placeholder posts are left out. A feed reader shows an item as something the
 * author published, and lorem ipsum is not that.
 */

export const SITE_FEED_PATH = '/rss.xml';

export const tagFeedPath = (tag: string): string => `/blog/tag/${tag}/rss.xml`;

export interface Feed {
  title: string;
  description: string;
  /** The HTML page the feed belongs to, relative to the site. */
  pagePath: string;
  /** The feed's own URL, relative to the site. */
  selfPath: string;
  posts: readonly BlogPost[];
}

const XML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&apos;',
};

const escapeXml = (text: string): string =>
  text.replace(/[&<>"']/g, (character) => XML_ESCAPES[character] ?? character);

/** RFC 822, which is what RSS 2.0 dates are, in UTC. */
const rfc822 = (date: Date): string =>
  date.toUTCString().replace('GMT', '+0000');

export const publishedPosts = (posts: readonly BlogPost[]): BlogPost[] =>
  posts.filter((post) => !post.data.placeholder);

const item = (post: BlogPost, site: URL): string => {
  const link = new URL(`/blog/${post.id}/`, site).href;
  return [
    '    <item>',
    `      <title>${escapeXml(post.data.title)}</title>`,
    `      <link>${link}</link>`,
    `      <guid isPermaLink="true">${link}</guid>`,
    `      <pubDate>${rfc822(post.data.date)}</pubDate>`,
    `      <description>${escapeXml(post.data.teaser)}</description>`,
    ...post.data.tags.map(
      (tag) => `      <category>${escapeXml(tag)}</category>`,
    ),
    '    </item>',
  ].join('\n');
};

export const feedXml = (feed: Feed, site: URL): string => {
  const posts = publishedPosts(feed.posts);
  const newest = posts[0]?.data.date;
  return [
    '<?xml version="1.0" encoding="utf-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
    '  <channel>',
    `    <title>${escapeXml(feed.title)}</title>`,
    `    <link>${new URL(feed.pagePath, site).href}</link>`,
    `    <description>${escapeXml(feed.description)}</description>`,
    '    <language>en-gb</language>',
    ...(newest ? [`    <lastBuildDate>${rfc822(newest)}</lastBuildDate>`] : []),
    `    <atom:link href="${new URL(feed.selfPath, site).href}" rel="self" type="application/rss+xml" />`,
    ...posts.map((post) => item(post, site)),
    '  </channel>',
    '</rss>',
    '',
  ].join('\n');
};

export const feedResponse = (feed: Feed, site: URL | undefined): Response => {
  if (!site) {
    throw new Error(
      'A feed needs `site` in astro.config.mjs: every link in it must be absolute.',
    );
  }
  /*
   * No Content-Type here: the route is prerendered to a file, and Cloudflare
   * serves `.xml` as application/xml, which feed readers accept.
   */
  return new Response(feedXml(feed, site));
};
