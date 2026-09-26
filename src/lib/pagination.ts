/** Posts on one page of /blog. No imports, so tests can use the real value. */
export const POSTS_PER_PAGE = 9;

export const pageCount = (total: number): number =>
  Math.max(1, Math.ceil(total / POSTS_PER_PAGE));

/** The slice of items on a 1-indexed page. */
export const postsOnPage = <T>(posts: readonly T[], page: number): T[] =>
  posts.slice((page - 1) * POSTS_PER_PAGE, page * POSTS_PER_PAGE);
