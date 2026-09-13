import { handle } from '@astrojs/cloudflare/handler';
import type { ContactEnv } from './lib/contact-env';
import { deleteExpiredMessages } from './lib/contact-retention';
import {
  isVideoRequest,
  serveVideo,
  type AssetsBinding,
} from './lib/video-range';

type WorkerEnv = ContactEnv & { ASSETS?: AssetsBinding };

/*
 * The Worker entry, named by `main` in wrangler.jsonc. Astro's handler serves
 * every request except /videos/*, which is sliced for byte ranges; the
 * scheduled handler is the retention sweep /privacy promises, run by the cron
 * trigger in the same file.
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
    env: ContactEnv,
    ctx: { waitUntil(promise: Promise<unknown>): void },
  ): Promise<void> {
    if (!env.MESSAGES_DB) {
      throw new Error('retention sweep: MESSAGES_DB binding missing');
    }

    ctx.waitUntil(
      deleteExpiredMessages(env.MESSAGES_DB, Date.now()).catch((error) => {
        console.error(
          'retention sweep failed:',
          error instanceof Error ? error.message : String(error),
        );
        throw error;
      }),
    );
  },
};
