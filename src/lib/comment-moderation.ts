import type { D1Database } from './contact-env';
import {
  MODERATION_LINK_DAYS,
  verifyLink,
  type LinkAction,
  type LinkClaims,
} from './comment-links';
import { findComment, isLinkUsed, type CommentRow } from './comment-store';
import type { RebuildResult } from './deploy-hook';

/*
 * What the two owner pages share: turning a link into a comment, and the words
 * for everything that can go wrong on the way.
 */

export type LinkProblem = 'invalid' | 'expired' | 'used' | 'gone';

export type ResolvedLink =
  | { ok: true; claims: LinkClaims; comment: CommentRow }
  | { ok: false; problem: LinkProblem };

/** The query parameter, and the form field, a link's token travels in. */
export const LINK_PARAM = 'link';

/** Set on the redirect after an action, so a refresh does not repeat it. */
export const DONE_PARAM = 'done';
export const REBUILD_PARAM = 'rebuild';

export const PROBLEM_STATUS: Readonly<Record<LinkProblem, number>> = {
  invalid: 400,
  expired: 410,
  used: 410,
  gone: 404,
};

/*
 * Functional copy for the owner. Each says what happened and what, if
 * anything, can still be done.
 */
export const PROBLEM_MESSAGE: Readonly<Record<LinkProblem, string>> = {
  invalid:
    'This link is not valid. Open it again from the notification email, and copy the whole address if you pasted it.',
  expired: `This link has expired. Links work for ${MODERATION_LINK_DAYS} days.`,
  used: 'This link has already been used.',
  gone: `This comment no longer exists. It was rejected, or deleted after ${MODERATION_LINK_DAYS} days without a decision.`,
};

export const REBUILD_MESSAGE: Readonly<Record<RebuildResult, string>> = {
  started:
    'The site is rebuilding, and the post shows it once the build finishes.',
  'not-configured':
    'The rebuild did not start because the deploy hook is not set up, so the post does not show it yet. It appears with the next deploy.',
  failed:
    'The rebuild did not start, so the post does not show it yet. It appears with the next deploy.',
};

export const isRebuildResult = (value: string | null): value is RebuildResult =>
  value === 'started' || value === 'not-configured' || value === 'failed';

/** Verifies a link and loads the comment it names. */
export const resolveLink = async (
  database: D1Database,
  signingKey: string,
  token: string,
  action: LinkAction,
  now: number,
): Promise<ResolvedLink> => {
  const check = await verifyLink(signingKey, token, action, now);

  if (!check.ok) {
    return {
      ok: false,
      problem: check.reason === 'expired' ? 'expired' : 'invalid',
    };
  }

  if (await isLinkUsed(database, check.claims.linkId)) {
    return { ok: false, problem: 'used' };
  }

  const comment = await findComment(database, check.claims.commentId);
  return comment
    ? { ok: true, claims: check.claims, comment }
    : { ok: false, problem: 'gone' };
};
