import type { APIRoute } from 'astro';

/*
 * robots.txt, generated rather than served as a static file, for the same
 * reason src/pages/site.webmanifest.ts is: the one fact in it that can go
 * wrong is a URL, and generating it keeps that URL derived instead of copied.
 *
 * `Sitemap:` has to be absolute. The format gives it no base to resolve
 * against, so a relative path is not a relative URL, it is an invalid line
 * crawlers skip in silence. Deriving it from `site` in astro.config.mjs means
 * it cannot disagree with the origin the sitemap's own entries carry.
 *
 * The name is `sitemap-index.xml`, not `sitemap.xml`: @astrojs/sitemap always
 * emits an index plus a numbered file. tests/sitemap.spec.ts asserts that
 * this line, the `<link rel="sitemap">` in BaseLayout.astro and the file the
 * build wrote all name the same thing.
 *
 * WHAT THIS FILE DELIBERATELY DOES NOT DO. It sets no AI-crawler policy.
 * specification.website grades that Recommended, but a `Disallow` aimed at
 * GPTBot, CCBot, ClaudeBot and the rest is a decision about how Sinduri's
 * writing may be used, not a technical default an agent should pick. Leaving
 * it out is permissive by omission, not by choice; TODO.md records it as a
 * question rather than as work.
 *
 * There is nothing else to disallow. Every route the build emits is public,
 * and `/404` is kept out of the sitemap rather than out of robots: `Disallow`
 * asks a crawler not to fetch a URL, which is not the same as declining to
 * advertise one, and blocking it would stop a crawler learning that a dead
 * link is dead.
 */

export const GET: APIRoute = ({ site }) => {
  /*
   * `site` is optional in Astro's types because a project can omit it. This
   * one cannot: the canonical links, the Open Graph URLs and the sitemap all
   * need it, so fail at build time rather than emit a Sitemap line reading
   * "undefined/sitemap-index.xml".
   */
  if (!site) {
    throw new Error(
      'robots.txt needs `site` in astro.config.mjs to write an absolute ' +
        'Sitemap URL. The sitemap, the canonical links and the Open Graph ' +
        'tags all need it too.',
    );
  }

  const body = [
    '# This site is not open to search indexes yet. Crawling is allowed on',
    '# purpose: every response carries `X-Robots-Tag: noindex`, and a crawler',
    '# that is not allowed to fetch a page never learns the page is noindex.',
    '# See the note in public/_headers before changing either.',
    '',
    'User-agent: *',
    'Allow: /',
    '',
    `Sitemap: ${new URL('sitemap-index.xml', site).href}`,
    '',
  ].join('\n');

  return new Response(body, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
