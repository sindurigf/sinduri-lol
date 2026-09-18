import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/*
 * Which built pages the sitemap advertises. Imported by astro.config.mjs, so
 * it runs in plain Node at config time and cannot reach `astro:content`: the
 * posts are read straight from their Markdown frontmatter instead.
 */

/** Where the posts live, relative to the project root the build runs in. */
const POSTS_DIR = 'src/content/blog';

/*
 * Two contact routes are deliberately unadvertised. /contact/sent/ is a
 * confirmation: a crawler served it reads "Your message has been received",
 * false for anyone who did not just send one. /contact/send/ is the POST
 * target, builds no page at all, and answers a GET with a redirect.
 */
const UNADVERTISED_PATHS = ['/contact/sent/', '/contact/send/'];

/** `/blog/<segment>/`: a post, a category listing, or the pager's parent. */
const BLOG_CHILD = /^\/blog\/([^/]+)\/$/;

/** The segment the paged index lives under, `/blog/page/<n>/`. */
const PAGED_SEGMENT = 'page';

/*
 * `/blog/tag/<tag>/`. Those pages carry `noindex`, so advertising them here
 * would ask a crawler to list a URL the page itself asks it not to. The posts
 * they hold are advertised on their own routes.
 */
const TAG_PREFIX = '/blog/tag/';

export interface PostSummary {
  slug: string;
  category: string;
}

/** Every post's slug and category, read from its frontmatter. */
export const readPosts = (dir = POSTS_DIR): PostSummary[] =>
  readdirSync(dir)
    .filter((name) => name.endsWith('.md'))
    .map((name) => {
      const source = readFileSync(join(dir, name), 'utf8');
      const category = /^category:\s*['"]?([a-z0-9-]+)['"]?\s*$/m.exec(
        source,
      )?.[1];
      if (!category) {
        throw new Error(`${name} has no category in its frontmatter.`);
      }
      return { slug: name.replace(/\.md$/, ''), category };
    });

/**
 * Whether the sitemap lists a page. A category listing is listed only while
 * it holds a post: an empty one says "No posts yet", and asking a crawler to
 * index that is asking it to index nothing.
 */
export const isAdvertised = (page: string, posts: PostSummary[]): boolean => {
  const { pathname } = new URL(page);

  if (UNADVERTISED_PATHS.some((path) => pathname.endsWith(path))) return false;
  if (pathname.includes(TAG_PREFIX)) return false;

  const segment = BLOG_CHILD.exec(pathname)?.[1];
  if (segment === undefined || segment === PAGED_SEGMENT) return true;
  if (posts.some((post) => post.slug === segment)) return true;

  return posts.some((post) => post.category === segment);
};
