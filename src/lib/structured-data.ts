import { CONTACT_EMAIL } from './contact';
import { PERSON_NAME, SOCIAL_PROFILES } from './profiles';

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
 * which is why TODO.md defers it rather than sitting it next to this.
 *
 * WHAT IS DELIBERATELY NOT HERE. No `BlogPosting` per post: ten of the eleven
 * posts are lorem ipsum (2026-09-12), and marking them up as articles would
 * ask search engines to index placeholder text as writing. TODO.md records
 * that it becomes worth doing when the posts are real.
 *
 * Nothing here is newly public. The name is the homepage <h1>, and the
 * profile URLs and the address are in the footer of every page. Structured
 * data restates what the site already says in a machine-readable form.
 */

/** The `@id` of the Person node, so other nodes can reference it. */
const personId = (origin: string): string => `${origin}/#person`;

/**
 * The site's JSON-LD graph, as one object.
 *
 * A `@graph` with two nodes rather than two script blocks, so the WebSite can
 * point at the Person by `@id` instead of repeating it, and a consumer that
 * reads one and not the other still gets a complete node.
 *
 * The same graph on every page, describing the site and its author rather
 * than the page. <link rel="canonical"> and <title> already say which page a
 * reader is on, and a third statement would be a third thing to keep in
 * agreement for no gain.
 */
export const structuredData = (site: URL): object => {
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
        '@id': `${origin}/#website`,
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
    ],
  };
};
