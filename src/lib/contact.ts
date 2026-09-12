/*
 * The public contact address, hosted at Porkbun.
 *
 * Deliberately not a personal mailbox: this string is rendered into every page
 * of a public static site, where it is permanently scrapeable and cannot be
 * unpublished.
 *
 * It lives here because two consumers must never disagree: the footer offers
 * it as the way to reach Sinduri, and `/.well-known/security.txt` offers it
 * as the way to report a vulnerability. A security.txt naming an address
 * nobody reads is worse than none, because it turns "there is no published
 * channel" into "there is one, and it was ignored".
 */
export const CONTACT_EMAIL = 'lol@sinduri.lol';
