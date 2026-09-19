import { getCollection, type CollectionEntry } from 'astro:content';
import { BLOG_CATEGORIES, type BlogCategory } from '../content.config';

export type BlogPost = CollectionEntry<'blog'>;

/**
 * How many posts the blog index puts on a page.
 *
 * `tests/routes.ts` carries a copy, because Playwright collects its test
 * files in plain Node and importing anything that reaches `astro:content`
 * fails there. The pagination test counts the cards the built pages render,
 * so the copy cannot drift silently.
 */
export const POSTS_PER_PAGE = 9;

/** Newest first. Every listing on the site is in this order. */
const sortByNewest = (posts: BlogPost[]): BlogPost[] =>
  [...posts].sort((a, b) => b.data.date.getTime() - a.data.date.getTime());

export const getSortedPosts = async (): Promise<BlogPost[]> =>
  sortByNewest(await getCollection('blog'));

export const getFeaturedPosts = async (limit: number): Promise<BlogPost[]> =>
  (await getSortedPosts()).filter((post) => post.data.featured).slice(0, limit);

/**
 * The categories at least one post is filed under. Only these are offered as
 * places to go: a category with nothing in it is a promise the site cannot
 * keep yet. Its page is still built, and `noindex` while empty.
 */
export const getCategoriesWithPosts = async (): Promise<Set<BlogCategory>> =>
  new Set((await getCollection('blog')).map((post) => post.data.category));

/** The props every post card takes straight from the post. */
export const cardProps = (post: BlogPost) => ({
  href: `/blog/${post.id}/`,
  title: post.data.title,
  teaser: post.data.teaser,
  category: post.data.category,
  date: post.data.date,
  readingTime: post.data.readingTime,
});

export const pageCount = (total: number): number =>
  Math.max(1, Math.ceil(total / POSTS_PER_PAGE));

/** The slice of posts on a 1-indexed page. */
export const postsOnPage = (posts: BlogPost[], page: number): BlogPost[] =>
  posts.slice((page - 1) * POSTS_PER_PAGE, page * POSTS_PER_PAGE);

/**
 * The URL of a page of the index.
 *
 * Page 1 is `/blog` and every later page is `/blog/page/<n>`. The extra
 * segment is not decoration: `/blog/[category]` and `/blog/[slug]` already
 * share the single segment after `/blog`, so a flat `/blog/2` would be a
 * third dynamic route competing for it, and a numeric category or post slug
 * would collide with a page number.
 */
export const indexPageHref = (page: number): string =>
  page <= 1 ? '/blog/' : `/blog/page/${page}/`;

/**
 * The category filter, as data.
 *
 * "All posts" is one of the options rather than a special case beside them, so
 * the active state is decided the same way for every entry and the markup has
 * one loop in it. `category: null` is the all-posts row.
 */
export interface CategoryFilterOption {
  label: string;
  href: string;
  category: BlogCategory | null;
}

/**
 * Category slugs are kebab-case; the label is the same string with the
 * hyphens turned back into spaces and the first letter capitalised.
 *
 * The capital is for the <title>, the one place this string is seen as
 * authored: every visible use is uppercased by CSS, but the document title is
 * not styled, so without it the category routes title themselves
 * `skincare | sinduri.lol` beside `Blog | sinduri.lol`.
 *
 * Sentence case, not Title Case: "Personal thoughts". This is consistency,
 * not conformance, which is why tests/titles.spec.ts asserts the shape of a
 * title and deliberately not its casing.
 */
export const categoryLabel = (category: BlogCategory | string): string => {
  const words = category.replaceAll('-', ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
};

/*
 * Tags whose label is not the slug with its first letter capitalised, because
 * a proper noun keeps its own capitals wherever it sits in the string.
 * Anything not named here reads as `categoryLabel` renders it.
 */
const TAG_LABELS: Record<string, string> = {
  drupal: 'Drupal',
  'women-in-drupal': 'Women in Drupal',
};

/** Tags are kebab-case in the frontmatter and read the same way categories do. */
export const tagLabel = (tag: string): string =>
  TAG_LABELS[tag] ?? categoryLabel(tag);

export const tagHref = (tag: string): string => `/blog/tag/${tag}/`;

/**
 * What each category holds, in Sinduri's words, drawn from her copy on
 * /about. The homepage cards and the category listing's meta description read
 * the same string, so the description a search result shows is the one a
 * reader saw on the way in.
 */
export const CATEGORY_TEASERS: Record<BlogCategory, string> = {
  skincare: 'Skincare routines, products and what works for me.',
  travel: 'Places I have travelled to, from Kerala to Vienna and beyond.',
  'personal-thoughts': 'Kindness, empathy and whatever else is on my mind.',
  'professional-journey':
    'From civil engineering to Drupal, and what I keep learning on the way.',
  'open-source': 'Drupal, community events and why there is room for everyone.',
};

/**
 * Every tag in use, with the posts carrying it, newest first within a tag and
 * the tags themselves alphabetical so the built routes do not reorder when a
 * post is added.
 */
export const getPostsByTag = async (): Promise<Map<string, BlogPost[]>> => {
  const byTag = new Map<string, BlogPost[]>();

  for (const post of await getSortedPosts()) {
    for (const tag of post.data.tags) {
      byTag.set(tag, [...(byTag.get(tag) ?? []), post]);
    }
  }

  return new Map([...byTag].sort(([a], [b]) => a.localeCompare(b)));
};

/*
 * One accent per category, used by every surface that shows a category, so a
 * category is the same colour wherever it appears. Complete class names
 * because Tailwind scans source text: a composed `text-${accent}` is
 * invisible to it.
 *
 * On `surface` #1A1A1A: gold 10.60, cyan 10.49, pink-text 7.18. `pink-text`
 * and never `pink` for a glyph, `pink` and never `pink-text` for a fill or a
 * shadow; see the two-pinks rule in the design system.
 */
const ACCENTS = {
  gold: {
    text: 'text-gold',
    shadow: 'shadow-hard-gold-8',
    tile: 'bg-gold text-background',
  },
  cyan: {
    text: 'text-cyan',
    shadow: 'shadow-hard-cyan-8',
    tile: 'bg-cyan text-darkcyan',
  },
  pink: {
    text: 'text-pink-text',
    shadow: 'shadow-hard-pink-8',
    tile: 'bg-pink text-background',
  },
} as const;

export type CategoryAccent = (typeof ACCENTS)[keyof typeof ACCENTS];

const CATEGORY_ACCENT: Record<BlogCategory, keyof typeof ACCENTS> = {
  'open-source': 'gold',
  'professional-journey': 'gold',
  skincare: 'cyan',
  travel: 'cyan',
  'personal-thoughts': 'pink',
};

export const categoryAccent = (category: BlogCategory): CategoryAccent =>
  ACCENTS[CATEGORY_ACCENT[category]];

export const CATEGORY_FILTERS: readonly CategoryFilterOption[] = [
  { label: 'All posts', href: '/blog/', category: null },
  ...BLOG_CATEGORIES.map((category) => ({
    label: categoryLabel(category),
    href: `/blog/${category}/`,
    category,
  })),
];
