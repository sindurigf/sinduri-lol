/* Profile URLs only, as JSON-LD `sameAs` needs; the email is separate. */

export const SOCIAL_PROFILES = [
  { href: 'https://github.com/sindurigf', label: 'GitHub' },
  {
    href: 'https://www.linkedin.com/in/sinduri-guntupalli-307542131',
    label: 'LinkedIn',
  },
  { href: 'https://www.instagram.com/sindurigf/', label: 'Instagram' },
  {
    href: 'https://bsky.app/profile/sinduri-lol.bsky.social',
    label: 'Bluesky',
  },
  { href: 'https://drupal.community/@sinduri', label: 'Mastodon' },
  { href: 'https://www.drupal.org/u/sinduri', label: 'Drupal' },
] as const;

/** The homepage <h1> spells it in two spans: tests/structured-data.spec.ts. */
export const PERSON_NAME = 'Sinduri Guntupalli';
