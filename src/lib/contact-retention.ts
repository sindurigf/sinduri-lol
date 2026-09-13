import type { D1Database } from './contact-env';
import { RETENTION_DAYS } from './contact-form';

const DAY_MS = 86_400_000;

/** Messages created before this, in Unix milliseconds, are past retention. */
export const retentionCutoff = (now: number): number =>
  now - RETENTION_DAYS * DAY_MS;

/** Deletes every stored message older than RETENTION_DAYS. */
export const deleteExpiredMessages = async (
  database: D1Database,
  now: number,
): Promise<void> => {
  await database
    .prepare('DELETE FROM messages WHERE created_at < ?')
    .bind(retentionCutoff(now))
    .run();
};
