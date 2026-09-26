import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { sortByNewest, type BlogPost } from '../lib/blog';
import { CONTACT_EMAIL } from '../lib/contact';
import {
  ABOUT_PATH,
  BLOG_PATH,
  CAREER_PATH,
  CONTACT_PATH,
  markdownSourcePath,
  postHref,
  SITE_FEED_PATH,
  SITEMAP_PATH,
} from '../lib/paths';
import { PERSON_NAME } from '../lib/profiles';
import { talkDecks } from '../lib/talk-deck';

/*
 * Descriptions are structural only; titles and teasers are quoted, never
 * summarised, so nothing is put in Sinduri's mouth. Placeholder posts are
 * listed and marked. tests/llms-txt.spec.ts checks against the build.
 */

const PLACEHOLDER_MARK = '(placeholder)';

/* Listings and /blog/page/N are omitted as reorderings of the posts. Each path must be a built route. */
const ROUTE_NOTES: { path: string; label: string; note: string }[] = [
  {
    path: '/',
    label: 'Home',
    note: 'Introduction, featured posts and the blog categories.',
  },
  {
    path: ABOUT_PATH,
    label: 'About',
    note:
      'Who she is: Vienna, cats, Lord of the Rings, and how a civil ' +
      'engineer came to Drupal.',
  },
  {
    path: CAREER_PATH,
    label: 'Career',
    note:
      'Work history, education, skills and open source work, with the CV ' +
      'linked as a PDF.',
  },
  {
    path: BLOG_PATH,
    label: 'Blog',
    note: 'The blog index, newest first; every published post is listed.',
  },
  { path: CONTACT_PATH, label: 'Contact', note: 'How to get in touch.' },
];

type Absolute = (path: string) => string;

const postLine = (post: BlogPost, absolute: Absolute): string =>
  `- [${post.data.title}](${absolute(postHref(post.id))}): ` +
  `${post.data.teaser} ([Markdown](${absolute(markdownSourcePath(post.id))}))` +
  (post.data.placeholder ? ` ${PLACEHOLDER_MARK}` : '');

const noteLines = (
  posts: readonly BlogPost[],
  absolute: Absolute,
): string[] => [
  `- Contact: ${CONTACT_EMAIL}`,
  `- Full URL list: ${absolute(SITEMAP_PATH)}`,
  `- RSS feed: ${absolute(SITE_FEED_PATH)}`,
  `- Security contact: ${absolute('/.well-known/security.txt')}`,
  ...(posts.some((post) => post.data.placeholder)
    ? [
        `- Posts marked ${PLACEHOLDER_MARK} are unfinished drafts whose title, ` +
          'teaser and body are lorem ipsum rather than writing. Please do not ' +
          'quote them, summarise them, or treat them as something the author ' +
          'said.',
      ]
    : []),
];

export const GET: APIRoute = async ({ site }) => {
  if (!site) {
    throw new Error(
      'llms.txt needs `site` in astro.config.mjs to write absolute URLs.',
    );
  }

  const absolute: Absolute = (path) => new URL(path, site).href;
  /* Not getSortedPosts: it drops placeholders, which this file must list. */
  const posts = sortByNewest(await getCollection('blog'));
  const talks = [...(await talkDecks())].map(([deck, slides]) => {
    const cover = slides[0]?.slide;
    if (!cover) throw new Error(`Talk deck ${deck} has no slides.`);
    return (
      `- [${cover.data.title}](${absolute(`/talks/${deck}/`)}): ` +
      'the slides, as a page.'
    );
  });

  const lines = [
    `# ${site.host}`,
    '',
    `> The personal site of ${PERSON_NAME}. Prerendered pages and one contact form endpoint, no cookies, cookie-free visit counts.`,
    '',
    '## Pages',
    '',
    ...ROUTE_NOTES.map(
      ({ path, label, note }) => `- [${label}](${absolute(path)}): ${note}`,
    ),
    '',
    '## Posts',
    '',
    ...posts.map((post) => postLine(post, absolute)),
    '',
    '## Talks',
    '',
    ...talks,
    '',
    '## Notes',
    '',
    ...noteLines(posts, absolute),
  ];

  return new Response(`${lines.join('\n')}\n`, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
