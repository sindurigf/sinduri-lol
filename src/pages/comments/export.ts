import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { MIN_EXPORT_KEY_LENGTH, exportKeyMatches } from '../../lib/comment-env';
import { listApprovedComments } from '../../lib/comment-store';
import { applyPrivateHeaders } from '../../lib/response-headers';

/*
 * Approved comments as JSON, for the build that renders them into posts.
 *
 * Behind a bearer key although everything it returns is already public, so
 * the build has something to read without holding database credentials: a D1
 * token would cover every table, contact messages included. The column list
 * in listApprovedComments is what keeps email out.
 */
export const prerender = false;

const json = (status: number, body: unknown, extra?: HeadersInit): Response => {
  const headers = applyPrivateHeaders(new Headers(extra));
  headers.set('Content-Type', 'application/json; charset=utf-8');
  return new Response(JSON.stringify(body), { status, headers });
};

export const GET: APIRoute = async ({ request }) => {
  const key = env.COMMENTS_EXPORT_KEY;
  const database = env.MESSAGES_DB;

  if (!key || key.length < MIN_EXPORT_KEY_LENGTH || !database) {
    console.error(
      'comments: export unavailable: MESSAGES_DB or a usable COMMENTS_EXPORT_KEY missing',
    );
    return json(503, { error: 'Comment export is not configured.' });
  }

  if (!(await exportKeyMatches(key, request.headers.get('Authorization')))) {
    return json(
      401,
      { error: 'A valid bearer key is required.' },
      { 'WWW-Authenticate': 'Bearer' },
    );
  }

  try {
    return json(200, { comments: await listApprovedComments(database) });
  } catch (error) {
    console.error(
      'comments: export failed:',
      error instanceof Error ? error.message : String(error),
    );
    return json(500, { error: 'Comments could not be read.' });
  }
};
