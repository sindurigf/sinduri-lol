import type { D1Database } from './contact-env';

/*
 * The Worker bindings and secrets the comment routes use. Optional for the
 * reason contact-env.ts gives: a missing one is an unfinished deploy, and each
 * route says so rather than acting as though it worked.
 */
export interface CommentEnv {
  /*
   * The same database as the contact form. The binding is named for the table
   * it held first; renaming it would detach the deployed Worker from its data.
   */
  MESSAGES_DB?: D1Database;
  /* Signs moderation links; see src/lib/comment-links.ts. */
  COMMENTS_SIGNING_KEY?: string;
  /* The bearer secret the build sends to /comments/export. */
  COMMENTS_EXPORT_KEY?: string;
  /* The Workers Builds deploy hook URL, itself a credential. */
  COMMENTS_DEPLOY_HOOK?: string;
}

/*
 * Anything shorter is a deploy mistake, and guessable in proportion. Treated
 * as no key, so the export refuses every request rather than accepting a weak
 * one.
 */
export const MIN_EXPORT_KEY_LENGTH = 32;

const BEARER = /^Bearer (.+)$/;

const sha256 = async (text: string): Promise<Uint8Array> =>
  new Uint8Array(
    await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)),
  );

/**
 * Whether an Authorization header carries the export key.
 *
 * Both sides are hashed before comparing, so the comparison always runs over
 * 32 bytes and its timing says nothing about how much of the key was right.
 */
export const exportKeyMatches = async (
  configured: string,
  authorization: string | null,
): Promise<boolean> => {
  const presented = BEARER.exec(authorization ?? '')?.[1];
  if (presented === undefined) return false;

  const [expected, actual] = await Promise.all([
    sha256(configured),
    sha256(presented),
  ]);

  let difference = 0;
  for (let index = 0; index < expected.length; index += 1) {
    difference |= expected[index]! ^ actual[index]!;
  }
  return difference === 0;
};
