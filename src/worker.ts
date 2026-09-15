import { handle } from '@astrojs/cloudflare/handler';
import type { ContactEnv } from './lib/contact-env';
import type { CommentEnv } from './lib/comment-env';
import { deleteExpiredMessages } from './lib/contact-retention';
import { sweepComments } from './lib/comment-retention';
import {
  isVideoRequest,
  serveVideo,
  type AssetsBinding,
} from './lib/video-range';

type WorkerEnv = ContactEnv & CommentEnv & { ASSETS?: AssetsBinding };

const logFailure = (sweep: string, work: Promise<void>): Promise<void> =>
  work.catch((error: unknown) => {
    console.error(
      `retention sweep failed: ${sweep}:`,
      error instanceof Error ? error.message : String(error),
    );
    throw error;
  });

/*
 * The Worker entry, named by `main` in wrangler.jsonc. Astro's handler serves
 * every request except /videos/*, which is sliced for byte ranges; the
 * scheduled handler is the retention sweep /privacy promises, for messages and
 * comments, run by the cron trigger in the same file.
 */
export default {
  async fetch(
    request: Request,
    env: WorkerEnv,
    ctx: Parameters<typeof handle>[2],
  ): Promise<Response> {
    if (!isVideoRequest(request)) return handle(request, env, ctx);

    if (!env.ASSETS) {
      throw new Error('video range: ASSETS binding missing');
    }
    return serveVideo(request, env.ASSETS);
  },

  async scheduled(
    _controller: unknown,
    env: WorkerEnv,
    ctx: { waitUntil(promise: Promise<unknown>): void },
  ): Promise<void> {
    const database = env.MESSAGES_DB;
    if (!database) {
      throw new Error('retention sweep: MESSAGES_DB binding missing');
    }

    const now = Date.now();

    /*
     * Settled rather than chained, so one sweep failing does not stop the
     * other from deleting what /privacy says it deletes.
     */
    ctx.waitUntil(
      Promise.allSettled([
        logFailure('messages', deleteExpiredMessages(database, now)),
        logFailure('comments', sweepComments(database, now)),
      ]).then((results) => {
        const failed = results.find((result) => result.status === 'rejected');
        if (failed) throw failed.reason;
      }),
    );
  },
};
