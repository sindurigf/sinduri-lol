/*
 * The header's link set, and the test for which of them is the current page.
 *
 * One module because the site has three navigations, in Header.astro, in its
 * no-JavaScript fallback and in MobileMenu.vue. Written out separately they
 * disagreed about what "current" means, and no test could see it, because
 * each nav was only ever asked about itself.
 *
 * The island imports these rather than receiving them as props: Astro
 * serialises an island's props into the document, so props would write the
 * whole link set into the HTML of every page as JSON as well as as markup.
 */

export interface NavLink {
  readonly href: string;
  readonly label: string;
}

export const HOME_HREF = '/';

/** The primary navigation, in the order it renders. */
export const NAV_LINKS: readonly NavLink[] = [
  { href: HOME_HREF, label: 'Home' },
  { href: '/about/', label: 'About' },
  { href: '/career/', label: 'Career' },
  { href: '/blog/', label: 'Blog' },
] as const;

/**
 * The desktop header's links: `NAV_LINKS` without Home.
 *
 * The logo link goes to `/` and sits directly before this list, so a Home
 * item would be two adjacent links to one URL on every page: an extra tab
 * stop, a duplicate entry in a links list, and WAVE's "Redundant link" alert.
 * The mobile dialog, the no-JavaScript fallback and the footer keep Home,
 * because none of them sits next to the logo.
 *
 * Derived rather than written out, so it cannot drift from `NAV_LINKS`.
 */
export const HEADER_LINKS: readonly NavLink[] = NAV_LINKS.filter(
  (link) => link.href !== HOME_HREF,
);

/**
 * The call to action. Separate from `NAV_LINKS` because it renders as a button
 * rather than as a link in the list, not because it is a lesser destination:
 * every navigation has to mark it current on /contact like any other page.
 */
export const CTA: NavLink = {
  href: '/contact/',
  label: 'Get in touch',
} as const;

/**
 * Whether `href` is the page currently being viewed.
 *
 * The match is the route itself or a route below it, never a bare prefix. A
 * bare `startsWith` fails quietly: `/career` also matches `/careers`, `/blog`
 * also matches `/blog-archive`, and the symptom is two nav items lit at once
 * on a route added later.
 *
 * Descendants count, which is why this is not a plain equality:
 * `/blog/some-post` and `/blog/page/2` are Blog. Both sides are compared with
 * a trailing slash, which is what separates a child route from a longer
 * sibling name (`/career/` is not a prefix of `/careers/`). The hrefs carry
 * the slash already; the current path may not, since dev serves `/about` as
 * well as `/about/`.
 *
 * `/` is special-cased because every path is below it, so it can only ever be
 * an equality test.
 */
const withTrailingSlash = (path: string): string =>
  path.endsWith('/') ? path : `${path}/`;

export const isActive = (currentPath: string, href: string): boolean =>
  href === HOME_HREF
    ? currentPath === HOME_HREF
    : withTrailingSlash(currentPath).startsWith(withTrailingSlash(href));
