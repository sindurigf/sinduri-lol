/*
 * The Worker bindings the contact endpoint uses, typed structurally.
 *
 * Declared here rather than by installing @cloudflare/workers-types: these are
 * the only bindings this site has, and a handful of signatures is less to
 * carry than a dependency whose types cover the whole platform.
 *
 * All are optional. A binding missing at runtime is a deploy that is not
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

export interface EmailAddress {
  email: string;
  name?: string;
}

/** The subset of the send_email builder API the notification uses. */
export interface EmailMessageBuilder {
  to: string;
  from: EmailAddress;
  replyTo: string;
  subject: string;
  text: string;
}

/** The Workers send_email binding. */
export interface SendEmail {
  send(message: EmailMessageBuilder): Promise<{ messageId: string }>;
}

export interface ContactEnv {
  MESSAGES_DB?: D1Database;
  CONTACT_RATE_LIMIT?: RateLimiter;
  CONTACT_MAILER?: SendEmail;
  /*
   * The site owner's inbox, a secret so the address stays out of this public
   * repository. It must be a verified Email Routing destination address.
   */
  CONTACT_NOTIFY_TO?: string;
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
 * production. Keying every request without one the same would rate limit
 * every such sender as one.
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
