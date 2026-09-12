import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { CONTACT_EMAIL } from '../lib/contact';
import { PERSON_NAME } from '../lib/profiles';

/*
 * /llms.txt, which specification.website grades Recommended under Agent
 * Readiness.
 *
 * WHAT IT IS. A short Markdown map of the site for a reader that arrived
 * without a browser: what this site is and what each route is for. A sitemap
 * says a URL exists and says nothing about what is at it.
 *
 * GENERATED, NOT public/llms.txt. The post list dates fastest, and a
 * hand-written file would be wrong the first time anything was published.
 * `getCollection` reads the same content the routes are built from, and
 * tests/llms-txt.spec.ts compares the output against the real build.
 *
 * WHAT IS SAID HERE IS DESCRIPTION, NOT EDITORIAL COPY, which is the line
 * AGENTS.md draws and matters most in a file that is nothing but prose. Every
 * sentence describes structure. Post titles and teasers are quoted from the
 * content, never summarised, so nothing is put in Sinduri's mouth.
 *
 * The note about placeholder copy is deliberate: most posts are lorem ipsum,
 * a reader that cannot see the page has no way to tell, and quoting Latin
 * filler as though it were writing would be worse for her than saying so.
 * Remove that note in the same commit as the last lorem post.
 *
 * IT NAMES NO COUNT AND FLAGS NO INDIVIDUAL POST, on purpose. The schema in
 * src/content.config.ts has no field saying whether a post is real, and a
 * hand-written count goes stale the first time one is replaced. The rule
 * given instead is one a reader can apply itself: text that reads as Latin
 * filler is not writing. Adding a `placeholder` boolean to the schema would
 * be better than both and is recorded in TODO.md, because it means editing
 * every post file for a change about one endpoint.
 */

/**
 * The non-post routes, each with what is at it.
 *
 * Category listings and `/blog/page/N` are deliberately left out: they are
 * different orderings of the posts listed below, so naming them would offer
 * the same content three times. `/404` is left out for the reason it is left
 * out of the sitemap. The sitemap link under Notes is the complete list.
 *
 * tests/llms-txt.spec.ts checks that every path here is a route the build
 * emitted, so a renamed or removed page fails rather than becoming a dead
 * link in a file nobody opens.
 */
const ROUTE_NOTES: { path: string; label: string; note: string }[] = [
  {
    path: '/',
    label: 'Home',
    note: 'Introduction, featured posts and the blog categories.',
  },
  {
    path: '/about/',
    label: 'About',
    note: 'Background and what she works on.',
  },
  {
    path: '/career/',
    label: 'Career',
    note:
      'Roles, education and talks, transcribed from the published CV, which ' +
      'the page links as a PDF.',
  },
  {
    path: '/blog/',
    label: 'Blog',
    note: 'The blog index. Paginated; every post is listed here.',
  },
  { path: '/contact/', label: 'Contact', note: 'How to get in touch.' },
];

export const GET: APIRoute = async ({ site }) => {
  if (!site) {
    throw new Error(
      'llms.txt needs `site` in astro.config.mjs to write absolute URLs. ' +
        'A reader that arrives here has no base to resolve a path against.',
    );
  }

  const absolute = (path: string): string => new URL(path, site).href;

  const posts = await getCollection('blog');
  /*
   * Newest first, matching the blog index. src/lib/blog.ts owns that
   * ordering for the rendered routes; this re-derives it rather than
   * importing, because that module also reaches for Astro rendering
   * internals this endpoint has no use for.
   */
  const sorted = [...posts].sort(
    (a, b) => b.data.date.valueOf() - a.data.date.valueOf(),
  );

  const lines = [
    `# ${site.host}`,
    '',
    `> The personal site of ${PERSON_NAME}. Static, no tracking, no cookies.`,
    '',
    '## Pages',
    '',
    ...ROUTE_NOTES.map(
      ({ path, label, note }) => `- [${label}](${absolute(path)}): ${note}`,
    ),
    '',
    '## Posts',
    '',
    /*
     * Titles and teasers are quoted, never summarised: summarising would put
     * words in Sinduri's mouth in a file whose audience cannot check them
     * against the page.
     */
    ...sorted.map(
      (post) =>
        `- [${post.data.title}](${absolute(`/blog/${post.id}/`)}): ` +
        `${post.data.teaser}`,
    ),
    '',
    '## Notes',
    '',
    `- Contact: ${CONTACT_EMAIL}`,
    `- Full URL list: ${absolute('/sitemap-index.xml')}`,
    `- Security contact: ${absolute('/.well-known/security.txt')}`,
  ];

  lines.push(
    '- This site is a work in progress. Several of the posts above are ' +
      'unfinished drafts whose title, teaser and body are lorem ipsum ' +
      'placeholder rather than writing. Any entry whose text reads as Latin ' +
      'filler is one of those: please do not quote it, summarise it, or ' +
      'treat it as something the author said.',
  );

  return new Response(`${lines.join('\n')}\n`, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
