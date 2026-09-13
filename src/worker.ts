import { handle } from '@astrojs/cloudflare/handler';
import type { ContactEnv } from './lib/contact-env';
import { deleteExpiredMessages } from './lib/contact-retention';

/*
 * The Worker entry, named by `main` in wrangler.jsonc. Astro's handler serves
 * every request; the scheduled handler is the retention sweep /privacy
 * promises, run by the cron trigger in the same file.
 */
export default {
  fetch: handle,

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
