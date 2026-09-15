import type { D1Database } from './contact-env';
import { RETENTION_DAYS } from './contact-form';
import { MODERATION_LINK_DAYS } from './comment-links';

const DAY_MS = 86_400_000;

/*
 * The same period as a contact message, so /privacy states one rule for every
 * email address the site holds. The comment itself stays.
 */
export const EMAIL_RETENTION_DAYS = RETENTION_DAYS;

/*
 * A comment nobody moderated is deleted when its links stop working, since
 * nothing could approve it after that.
 */
export const PENDING_RETENTION_DAYS = MODERATION_LINK_DAYS;

export const emailCutoff = (now: number): number =>
  now - EMAIL_RETENTION_DAYS * DAY_MS;

export const pendingCutoff = (now: number): number =>
  now - PENDING_RETENTION_DAYS * DAY_MS;

/**
 * Clears expired commenter emails, deletes comments left pending past their
 * links, and forgets used links that have expired anyway.
 */
export const sweepComments = async (
  database: D1Database,
  now: number,
): Promise<void> => {
  await database.batch([
    database
      .prepare(
        'UPDATE comments SET email = NULL WHERE email IS NOT NULL AND created_at < ?',
      )
      .bind(emailCutoff(now)),
    database
      .prepare(
        "DELETE FROM comments WHERE status = 'pending' AND created_at < ?",
      )
      .bind(pendingCutoff(now)),
    database.prepare('DELETE FROM used_links WHERE expires_at < ?').bind(now),
  ]);
};
