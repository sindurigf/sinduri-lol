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
 * PLACEHOLDER POSTS ARE MARKED, from the `placeholder` field in the schema.
 * A reader that cannot see the page has no way to tell lorem ipsum from
 * writing, and quoting it as something Sinduri said would be worse than
 * saying so. The note explaining the mark is emitted only while a post
 * carries it.
 */

const PLACEHOLDER_MARK = '(placeholder)';

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
        `${post.data.teaser}` +
        (post.data.placeholder ? ` ${PLACEHOLDER_MARK}` : ''),
    ),
    '',
    '## Notes',
    '',
    `- Contact: ${CONTACT_EMAIL}`,
    `- Full URL list: ${absolute('/sitemap-index.xml')}`,
    `- Security contact: ${absolute('/.well-known/security.txt')}`,
  ];

  if (sorted.some((post) => post.data.placeholder)) {
    lines.push(
      `- Posts marked ${PLACEHOLDER_MARK} are unfinished drafts whose title, ` +
        'teaser and body are lorem ipsum rather than writing. Please do not ' +
        'quote them, summarise them, or treat them as something the author ' +
        'said.',
    );
  }

  return new Response(`${lines.join('\n')}\n`, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
