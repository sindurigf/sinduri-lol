/*
 * Starts a Workers Builds build, which is how an approved comment reaches its
 * post: comments are rendered into the static pages at build time.
 */

export type RebuildResult = 'started' | 'not-configured' | 'failed';

/*
 * Plain http only to this machine, which is the stub tests/comments.spec.ts
 * runs. A real hook is https, and anything else is a misconfigured secret.
 */
const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost']);

const hookUrl = (configured: string | undefined): URL | null => {
  if (!configured) return null;
  try {
    const url = new URL(configured);
    const secure =
      url.protocol === 'https:' ||
      (url.protocol === 'http:' && LOOPBACK_HOSTS.has(url.hostname));
    return secure ? url : null;
  } catch {
    return null;
  }
};

/** POSTs the deploy hook. Never throws: the caller reports the result. */
export const requestRebuild = async (
  configured: string | undefined,
): Promise<RebuildResult> => {
  const url = hookUrl(configured);

  if (!url) {
    console.error(
      'comments: rebuild not started: COMMENTS_DEPLOY_HOOK missing or not a valid URL',
    );
    return 'not-configured';
  }

  try {
    const response = await fetch(url, { method: 'POST' });
    if (response.ok) return 'started';

    console.error(
      `comments: rebuild not started: hook answered ${response.status}`,
    );
    return 'failed';
  } catch (error) {
    console.error(
      'comments: rebuild not started:',
      error instanceof Error ? error.message : String(error),
    );
    return 'failed';
  }
};
