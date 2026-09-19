import { categoryLabel } from './blog';

/*
 * The trail above a page's heading, from the home page down to the page's
 * parent. The page itself is not a visible crumb: its <h1> sits directly
 * under the trail, and repeating a post title there is noise. The WAI-ARIA
 * breadcrumb pattern allows a trail that stops at the parent.
 *
 * The JSON-LD does end with the page, because a BreadcrumbList describes the
 * page's position, and Google takes the last item without a URL as the page
 * it sits on.
 */

export interface Crumb {
  label: string;
  href: string;
}

export interface Trail {
  /** Home down to the parent, each a link. */
  crumbs: readonly Crumb[];
  /** The page itself, named for the JSON-LD only. */
  current: string;
}

const HOME: Crumb = { label: 'Home', href: '/' };
const BLOG: Crumb = { label: 'Blog', href: '/blog/' };

export const categoryCrumb = (category: string): Crumb => ({
  label: categoryLabel(category),
  href: `/blog/${category}/`,
});

export const blogTrail = (current: string): Trail => ({
  crumbs: [HOME, BLOG],
  current,
});

export const postTrail = (category: string, current: string): Trail => ({
  crumbs: [HOME, BLOG, categoryCrumb(category)],
  current,
});
