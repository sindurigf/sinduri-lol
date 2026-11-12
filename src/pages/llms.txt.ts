import type { APIRoute } from 'astro';
import { requireSite } from '../lib/site';
import { getCollection } from 'astro:content';
import { sortByNewest, type BlogPost } from '../lib/blog';
import { CONTACT_EMAIL } from '../lib/contact';
import {
  ABOUT_PATH,
  ACCESSIBILITY_PATH,
  BLOG_PATH,
  CAREER_PATH,
  CONTACT_PATH,
  CREDITS_PATH,
  markdownSourcePath,
  postHref,
  PRIVACY_PATH,
  SITE_FEED_PATH,
  SITEMAP_PATH,
} from '../lib/paths';
import { PERSON_NAME } from '../lib/profiles';
import { talkDecks } from '../lib/talk-deck';
import { BRAND_PATH, BRAND_SECTIONS, brandHref } from '../lib/brand-sections';

/*
 * Post titles and teasers are quoted, never summarized: editorial copy is never invented (AGENTS.md "Copy").
 * Placeholder posts are listed and marked; tests/llms-txt.spec.ts checks against the build.
 */

const PLACEHOLDER_MARK = '(placeholder)';

/* Listings and /blog/page/N are omitted as reorderings of the posts. Each path must be a built route. */
const ROUTE_NOTES: { path: string; label: string; note: string }[] = [
  {
    path: '/',
    label: 'Home',
    note: 'A short introduction, my featured posts and the blog categories.',
  },
  {
    path: ABOUT_PATH,
    label: 'About',
    note:
      'My life in Vienna with my husband and three cats, and why my nickname ' +
      'is Bunny. My friends, the stories, music and food I love, and how I ' +
      'went from civil engineering to my first Drupal job in 2021.',
  },
  {
    path: CAREER_PATH,
    label: 'Career',
    note:
      'My work history, education, skills and open source work, with my CV ' +
      'as a PDF.',
  },
  {
    path: BLOG_PATH,
    label: 'Blog',
    note: 'All my posts, newest first.',
  },
  {
    path: CONTACT_PATH,
    label: 'Contact',
    note: 'How to get in touch with me.',
  },
  {
    path: BRAND_PATH,
    label: 'Brand',
    note:
      'The design system of my website on one page, with its sections ' +
      'listed below.',
  },
  {
    path: ACCESSIBILITY_PATH,
    label: 'Accessibility',
    note:
      'What I aim for on my website, what I have tested, what I have not, ' +
      'and how to report a barrier.',
  },
  {
    path: PRIVACY_PATH,
    label: 'Privacy',
    note:
      'What my website collects: visit counts and contact form messages, ' +
      'each kept for a set time. It sets no cookies.',
  },
  {
    path: CREDITS_PATH,
    label: 'Credits',
    note:
      'Where the name comes from, who took the photos, and what I built ' +
      'and tested my website with.',
  },
];

type Absolute = (path: string) => string;

/* blog/[slug].md.ts builds no Markdown copy of a placeholder. */
const postLine = (post: BlogPost, absolute: Absolute): string =>
  `- [${post.data.title}](${absolute(postHref(post.id))}): ${post.data.teaser}` +
  (post.data.placeholder
    ? ` ${PLACEHOLDER_MARK}`
    : ` ([Markdown](${absolute(markdownSourcePath(post.id))}))`);

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
        `- Posts marked ${PLACEHOLDER_MARK} are unfinished drafts. Their ` +
          'title, teaser and body are lorem ipsum, not my writing. Please do ' +
          'not quote or summarize them, or treat them as something I said.',
      ]
    : []),
];

export const GET: APIRoute = async ({ site: configuredSite }) => {
  const site = requireSite(configuredSite, 'llms.txt writes absolute URLs.');

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
    `> I am ${PERSON_NAME}, and this is my personal website. It is prerendered pages and one contact form endpoint, with no cookies and cookie-free visit counts.`,
    '',
    '## Pages',
    '',
    ...ROUTE_NOTES.map(
      ({ path, label, note }) => `- [${label}](${absolute(path)}): ${note}`,
    ),
    '',
    '## Design System',
    '',
    ...BRAND_SECTIONS.map(
      ({ slug, title, description }) =>
        `- [${title}](${absolute(brandHref(slug))}): ${description}`,
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
