/*
 * Where Sinduri is, elsewhere.
 *
 * A module rather than a constant in Footer.astro because two consumers need
 * different subsets: the footer renders all of these as links plus the email,
 * and the JSON-LD in src/lib/structured-data.ts publishes them as `sameAs`,
 * which takes profile URLs only.
 *
 * The email is deliberately not here. It lives in src/lib/contact.ts, is a
 * `mailto:` rather than a profile, and schema.org has `email` for it.
 *
 * The footer already renders every URL here into every page, so nothing in
 * this file is newly public.
 */

export const SOCIAL_PROFILES = [
  { href: 'https://github.com/sindurigf', label: 'GitHub' },
  {
    href: 'https://at.linkedin.com/in/sinduri-guntupalli-307542131',
    label: 'LinkedIn',
  },
  { href: 'https://www.instagram.com/sindurigf/', label: 'Instagram' },
  {
    href: 'https://bsky.app/profile/sinduri-lol.bsky.social',
    label: 'Bluesky',
  },
  /*
   * A Mastodon account that happens to be hosted on the Drupal community's
   * instance. The label names the service, not the server; the Drupal profile
   * is the entry below.
   */
  { href: 'https://drupal.community/@sinduri', label: 'Mastodon' },
  { href: 'https://www.drupal.org/u/sinduri', label: 'Drupal' },
] as const;

/**
 * The name the homepage <h1> says, in one piece.
 *
 * The heading renders it as two spans so the lines can take different
 * colours, so it does not import this and the two could disagree.
 * tests/structured-data.spec.ts compares this against the text of that
 * heading in the built HTML, so a rename that touched only one of them fails.
 */
export const PERSON_NAME = 'Sinduri Guntupalli';
