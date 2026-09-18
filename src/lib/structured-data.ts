import { CONTACT_EMAIL } from './contact';
import { PERSON_NAME, SOCIAL_PROFILES } from './profiles';
import type { Trail } from './breadcrumbs';

/*
 * JSON-LD, which specification.website grades Recommended under both SEO and
 * Agent Readiness.
 *
 * WHY THIS MAY BE INLINE UNDER A CSP WITH NO 'unsafe-inline'. The content
 * differs per page and a static host has no request-time nonce, so a hash for
 * it cannot exist. It needs none: `script-src` gates scripts the browser
 * runs, and a `<script type="application/ld+json">` is never run, because the
 * HTML spec's "prepare the script element" steps stop before the CSP check
 * for a type that is not JavaScript, not a module, not an import map and not
 * speculation rules.
 *
 * Measured rather than assumed. With this block emitted and no hash for it,
 * the site runs clean under the policy in Chromium and Firefox, and the
 * mobile menu still hydrates, which proves the policy is enforced rather than
 * silently absent. WebKit cannot run on this machine, so CI checks the third
 * engine; if it disagrees the failure is harmless, because nothing on the
 * page reads the block. `type="speculationrules"` IS subject to script-src,
 * so speculation rules cannot be inlined beside this the same way.
 *
 * WHAT IS NOT HERE YET. No `BlogPosting` per post. Nothing blocks it: it is
 * unbuilt, not declined.
 *
 * Nothing here is newly public. The name is the homepage <h1>, and the
 * profile URLs and the address are in the footer of every page. Structured
 * data restates what the site already says in a machine-readable form.
 */

/** The `@id` of the Person node, so other nodes can reference it. */
const personId = (origin: string): string => `${origin}/#person`;
const websiteId = (origin: string): string => `${origin}/#website`;

/** What a post knows about itself. `datePublished` is `YYYY-MM-DD`. */
export interface ArticleMeta {
  headline: string;
  datePublished: string;
  keywords: readonly string[];
}

/** A post's own facts plus the page facts BaseLayout already holds. */
export interface ArticleData extends ArticleMeta {
  description: string;
  url: URL;
  image: URL;
}

const blogPosting = (origin: string, article: ArticleData): object => ({
  '@type': 'BlogPosting',
  '@id': `${article.url.href}#post`,
  headline: article.headline,
  description: article.description,
  url: article.url.href,
  mainEntityOfPage: article.url.href,
  image: article.image.href,
  datePublished: article.datePublished,
  keywords: article.keywords.join(', '),
  inLanguage: 'en',
  author: { '@id': personId(origin) },
  publisher: { '@id': personId(origin) },
  isPartOf: { '@id': websiteId(origin) },
});

/*
 * The page's place in the site, ending with the page itself. Google takes a
 * last item without `item` as the page the list sits on, which is why the
 * visible trail can stop at the parent while this does not.
 */
const breadcrumbList = (site: URL, page: URL, trail: Trail): object => ({
  '@type': 'BreadcrumbList',
  '@id': `${page.href}#breadcrumb`,
  itemListElement: [
    ...trail.crumbs.map((crumb, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: crumb.label,
      item: new URL(crumb.href, site).href,
    })),
    {
      '@type': 'ListItem',
      position: trail.crumbs.length + 1,
      name: trail.current,
    },
  ],
});

/**
 * The site's JSON-LD graph, as one object.
 *
 * A `@graph` rather than one script block per node, so the WebSite can
 * point at the Person by `@id` instead of repeating it, and a consumer that
 * reads one and not the other still gets a complete node.
 *
 * The same graph on every page, describing the site and its author rather
 * than the page. <link rel="canonical"> and <title> already say which page a
 * reader is on. Two additions are per page: a post adds a BlogPosting, since
 * its date and author are facts no other tag carries, and a page with a
 * breadcrumb trail adds the BreadcrumbList for it.
 */
export const structuredData = (
  site: URL,
  article?: ArticleData,
  breadcrumbs?: { page: URL; trail: Trail },
): object => {
  const origin = site.origin;

  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Person',
        '@id': personId(origin),
        name: PERSON_NAME,
        url: origin,
        email: `mailto:${CONTACT_EMAIL}`,
        /*
         * `sameAs` connects this site to profiles a search engine already
         * knows about, and takes profile URLs only: the email is carried by
         * `email` above, and repeating it here would be two claims where one
         * is meant.
         */
        sameAs: SOCIAL_PROFILES.map((profile) => profile.href),
      },
      {
        '@type': 'WebSite',
        '@id': websiteId(origin),
        url: origin,
        name: site.host,
        /*
         * By reference, not by value. Repeating the Person node here would
         * create a second entity that happens to look the same, which is the
         * mistake `@id` exists to prevent.
         */
        author: { '@id': personId(origin) },
        publisher: { '@id': personId(origin) },
        inLanguage: 'en',
      },
      ...(article ? [blogPosting(origin, article)] : []),
      ...(breadcrumbs
        ? [breadcrumbList(site, breadcrumbs.page, breadcrumbs.trail)]
        : []),
    ],
  };
};
