/*
 * The Worker bindings the contact endpoint uses, typed structurally.
 *
 * Declared here rather than by installing @cloudflare/workers-types: these are
 * the only two bindings this site has, and three method signatures is less to
 * carry than a dependency whose types cover the whole platform.
 *
 * Both are optional. A binding missing at runtime is a deploy that is not
 * finished, and the endpoint says so rather than behaving as though the
 * message was received.
 */

export interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  run(): Promise<unknown>;
}

export interface D1Database {
  prepare(query: string): D1PreparedStatement;
}

/** The Workers rate limiting binding. */
export interface RateLimiter {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

export interface ContactEnv {
  MESSAGES_DB?: D1Database;
  CONTACT_RATE_LIMIT?: RateLimiter;
}

/**
 * A rate-limit key for a request, without storing or logging the address.
 *
 * The limiter needs something stable per sender; `/privacy` says this site
 * stores nothing about a visitor. A SHA-256 of the address and the current
 * date satisfies both: it is stable for a day, it never leaves the limiter,
 * and it is not written anywhere. The date rotates it so a hash cannot be
 * correlated across days.
 *
 * Null when there is no address. `CF-Connecting-IP` is set by Cloudflare and
 * any client-supplied copy is replaced at the edge, so it is always present in
 * production and absent only when nothing is in front of this Worker, which
 * means local dev. Keying every such request the same would rate limit the
 * whole machine as one sender, which is what it did: two local submissions in
 * a row returned 429.
 */
export const rateLimitKey = async (
  request: Request,
): Promise<string | null> => {
  const address = request.headers.get('CF-Connecting-IP');
  if (address === null) return null;

  const day = new Date().toISOString().slice(0, 10);

  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(`${address}:${day}`),
  );

  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
};
