import type { APIRoute } from 'astro';
import { CONTACT_EMAIL } from '../../lib/contact';

/*
 * /.well-known/security.txt, per RFC 9116. specification.website grades it
 * Recommended.
 *
 * WHAT IT IS FOR. It answers one question for somebody who has just found a
 * problem: where do I send this. Without it the honest finder guesses, and
 * the guesses are a public GitHub issue, a LinkedIn message, or nothing.
 *
 * The address is imported from src/lib/contact.ts rather than repeated,
 * because the failure this file invites is a `Contact:` nobody reads, which
 * is worse than publishing no security.txt.
 *
 * GENERATED, NOT public/.well-known/security.txt, which also works.
 * `Canonical:` has to be an absolute URL, and generating the file derives it
 * from `site` in astro.config.mjs instead of putting a second copy of the
 * origin somewhere scripts/check-tokens.mjs never looks.
 *
 * THE EXPIRY IS HARDCODED, AND THAT IS THE WHOLE DESIGN. RFC 9116 makes
 * `Expires` mandatory and says a value more than a year out SHOULD NOT be
 * used. Computing `now + 1 year` at build time never lapses and needs no
 * maintenance, and it is wrong: the field says a human still stands behind
 * this address, and reading it off the clock asserts that afresh on every
 * build while nobody has confirmed anything.
 *
 * So it is a literal, and tests/security-txt.spec.ts fails once it is within
 * EXPIRY_WARNING_DAYS of lapsing. That test can turn CI red on a day nobody
 * changed a line, which is intended: the alternative is the file quietly
 * expiring in production with nothing to report it.
 */

/**
 * When the commitment above lapses. RFC 9116 section 2.5.5: not more than a
 * year out. Move it forward only when someone has actually confirmed that
 * CONTACT_EMAIL is still read, and say so in the commit.
 */
const EXPIRES = '2027-09-09T00:00:00.000Z';

export const GET: APIRoute = ({ site }) => {
  if (!site) {
    throw new Error(
      'security.txt needs `site` in astro.config.mjs to write an absolute ' +
        'Canonical URL. RFC 9116 requires it to be absolute.',
    );
  }

  const canonical = new URL('.well-known/security.txt', site).href;

  const body = [
    '# https://sinduri.lol -- see RFC 9116.',
    '#',
    '# This is a personal, static site: no server-side code, no database, no',
    '# accounts and no user data. The interesting surface is the response',
    '# headers and the published documents, not an application.',
    '',
    `Contact: mailto:${CONTACT_EMAIL}`,
    `Expires: ${EXPIRES}`,
    'Preferred-Languages: en',
    `Canonical: ${canonical}`,
    '',
  ].join('\n');

  return new Response(body, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
