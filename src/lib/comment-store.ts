import type { D1Database, D1PreparedStatement } from './contact-env';
import type { LinkClaims } from './comment-links';
import { OWNER_NAME } from './comment-form';

/*
 * Every query the comment routes run. Column lists are written out, never
 * `SELECT *`, so a query that feeds anything public cannot pick up `email` by
 * accident when the table grows.
 */

export interface CommentRow {
  id: string;
  post_slug: string;
  parent_id: string | null;
  name: string;
  email: string | null;
  body: string;
  status: 'pending' | 'approved';
  is_owner: 0 | 1;
  created_at: number;
}

/** A comment as the build receives it. No email, by construction. */
export interface PublicComment {
  id: string;
  post: string;
  parent: string | null;
  name: string;
  body: string;
  isOwner: boolean;
  /** ISO 8601. */
  createdAt: string;
}

export type ModerationResult = 'done' | 'link-used' | 'not-pending';

export const findComment = (
  database: D1Database,
  id: string,
): Promise<CommentRow | null> =>
  database
    .prepare(
      'SELECT id, post_slug, parent_id, name, email, body, status, is_owner, created_at ' +
        'FROM comments WHERE id = ?',
    )
    .bind(id)
    .first<CommentRow>();

export const isLinkUsed = async (
  database: D1Database,
  linkId: string,
): Promise<boolean> =>
  (await database
    .prepare('SELECT id FROM used_links WHERE id = ?')
    .bind(linkId)
    .first()) !== null;

const claimLink = (
  database: D1Database,
  claims: LinkClaims,
): D1PreparedStatement =>
  database
    .prepare('INSERT INTO used_links (id, expires_at) VALUES (?, ?)')
    .bind(claims.linkId, claims.expiresAt);

const approve = (
  database: D1Database,
  id: string,
  now: number,
): D1PreparedStatement =>
  database
    .prepare(
      "UPDATE comments SET status = 'approved', approved_at = ? WHERE id = ? AND status = 'pending'",
    )
    .bind(now, id);

/*
 * The checks before each batch give the reader a precise answer. The batch is
 * still what guarantees single use: two requests racing past the check both
 * insert the same link id, and the second rolls back.
 */
const moderate = async (
  database: D1Database,
  claims: LinkClaims,
  action: D1PreparedStatement,
): Promise<ModerationResult> => {
  if (await isLinkUsed(database, claims.linkId)) return 'link-used';

  const comment = await findComment(database, claims.commentId);
  if (comment?.status !== 'pending') return 'not-pending';

  await database.batch([claimLink(database, claims), action]);
  return 'done';
};

export const approveComment = (
  database: D1Database,
  claims: LinkClaims,
  now: number,
): Promise<ModerationResult> =>
  moderate(database, claims, approve(database, claims.commentId, now));

/** Rejecting deletes: a rejected comment is kept nowhere. */
export const rejectComment = (
  database: D1Database,
  claims: LinkClaims,
): Promise<ModerationResult> =>
  moderate(
    database,
    claims,
    database
      .prepare("DELETE FROM comments WHERE id = ? AND status = 'pending'")
      .bind(claims.commentId),
  );

/**
 * Publishes the owner's reply to a comment, approving that comment too if it
 * is still pending: replying to it is a decision to show it.
 *
 * A reply to a reply joins the thread of the top-level comment, because
 * threads are one level deep.
 */
export const publishOwnerReply = async (
  database: D1Database,
  claims: LinkClaims,
  parent: CommentRow,
  body: string,
  now: number,
): Promise<'done' | 'link-used'> => {
  if (await isLinkUsed(database, claims.linkId)) return 'link-used';

  const threadId = parent.parent_id ?? parent.id;

  await database.batch([
    claimLink(database, claims),
    approve(database, parent.id, now),
    database
      .prepare(
        'INSERT INTO comments (id, post_slug, parent_id, name, email, body, status, is_owner, created_at, approved_at) ' +
          "VALUES (?, ?, ?, ?, NULL, ?, 'approved', 1, ?, ?)",
      )
      .bind(
        crypto.randomUUID(),
        parent.post_slug,
        threadId,
        OWNER_NAME,
        body,
        now,
        now,
      ),
  ]);
  return 'done';
};

interface PublicRow {
  id: string;
  post_slug: string;
  parent_id: string | null;
  name: string;
  body: string;
  is_owner: 0 | 1;
  created_at: number;
}

/** Every approved comment, oldest first, with public fields only. */
export const listApprovedComments = async (
  database: D1Database,
): Promise<PublicComment[]> => {
  const { results } = await database
    .prepare(
      'SELECT id, post_slug, parent_id, name, body, is_owner, created_at ' +
        "FROM comments WHERE status = 'approved' ORDER BY created_at, id",
    )
    .all<PublicRow>();

  return results.map((row) => ({
    id: row.id,
    post: row.post_slug,
    parent: row.parent_id,
    name: row.name,
    body: row.body,
    isOwner: row.is_owner === 1,
    createdAt: new Date(row.created_at).toISOString(),
  }));
};
