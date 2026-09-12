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

export const CATEGORY_FILTERS: readonly CategoryFilterOption[] = [
  { label: 'All posts', href: '/blog/', category: null },
  ...BLOG_CATEGORIES.map((category) => ({
    label: categoryLabel(category),
    href: `/blog/${category}/`,
    category,
  })),
];
