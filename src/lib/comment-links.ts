/*
 * Signed moderation links, sent to the owner and to nobody else.
 *
 * A link carries what it may do, to which comment, until when, and its own
 * id, signed with HMAC-SHA256 under COMMENTS_SIGNING_KEY. The signature stops
 * a link being forged or edited; the id, recorded in `used_links` when the
 * link is used, stops it being used twice. Opening a link changes nothing:
 * mail scanners fetch links on arrival, so every action is a POST from the
 * page the link opens.
 */

/** Opens the review page (approve or reject) or the owner's reply page. */
export type LinkAction = 'review' | 'reply';

const LINK_ACTIONS: readonly LinkAction[] = ['review', 'reply'];

export interface LinkClaims {
  action: LinkAction;
  commentId: string;
  linkId: string;
  /** Unix milliseconds. */
  expiresAt: number;
}

export type LinkCheck =
  | { ok: true; claims: LinkClaims }
  | { ok: false; reason: 'malformed' | 'forged' | 'expired' | 'wrong-action' };

/*
 * How long a link works. A pending comment is deleted at the same age, see
 * src/lib/comment-retention.ts, so no link outlives the comment it acts on.
 */
export const MODERATION_LINK_DAYS = 30;

/*
 * A shorter secret is a deploy mistake, and signing with it would make every
 * link guessable in proportion. Treated as no key at all.
 */
export const MIN_SIGNING_KEY_LENGTH = 32;

/* Far longer than any real link; bounds the work an arbitrary query can cause. */
const MAX_TOKEN_LENGTH = 512;

const DAY_MS = 86_400_000;

const UUID_SHAPE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const encoder = new TextEncoder();

const toBase64Url = (bytes: Uint8Array): string =>
  btoa(String.fromCharCode(...bytes))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/, '');

const fromBase64Url = (text: string): Uint8Array<ArrayBuffer> | null => {
  if (!/^[A-Za-z0-9_-]*$/.test(text)) return null;
  try {
    const binary = atob(text.replaceAll('-', '+').replaceAll('_', '/'));
    return Uint8Array.from(binary, (char) => char.charCodeAt(0));
  } catch {
    return null;
  }
};

const hmacKey = (
  secret: string,
  usage: 'sign' | 'verify',
): Promise<CryptoKey> =>
  crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    [usage],
  );

/** The configured key, or null when it is missing or too short to trust. */
export const usableSigningKey = (secret: string | undefined): string | null =>
  secret !== undefined && secret.length >= MIN_SIGNING_KEY_LENGTH
    ? secret
    : null;

/** Fresh claims for a new link to one comment. */
export const newLinkClaims = (
  action: LinkAction,
  commentId: string,
  now: number,
): LinkClaims => ({
  action,
  commentId,
  linkId: crypto.randomUUID(),
  expiresAt: now + MODERATION_LINK_DAYS * DAY_MS,
});

/** The token a link carries in its `link` query parameter. */
export const signLink = async (
  secret: string,
  claims: LinkClaims,
): Promise<string> => {
  const payload = toBase64Url(
    encoder.encode(
      JSON.stringify([
        claims.action,
        claims.commentId,
        claims.linkId,
        claims.expiresAt,
      ]),
    ),
  );
  const signature = await crypto.subtle.sign(
    'HMAC',
    await hmacKey(secret, 'sign'),
    encoder.encode(payload),
  );
  return `${payload}.${toBase64Url(new Uint8Array(signature))}`;
};

const parseClaims = (payload: Uint8Array): LinkClaims | null => {
  let decoded: unknown;
  try {
    decoded = JSON.parse(new TextDecoder().decode(payload));
  } catch {
    return null;
  }

  if (!Array.isArray(decoded) || decoded.length !== 4) return null;
  const [action, commentId, linkId, expiresAt] = decoded as unknown[];

  const valid =
    LINK_ACTIONS.includes(action as LinkAction) &&
    typeof commentId === 'string' &&
    UUID_SHAPE.test(commentId) &&
    typeof linkId === 'string' &&
    UUID_SHAPE.test(linkId) &&
    Number.isSafeInteger(expiresAt);

  return valid
    ? {
        action: action as LinkAction,
        commentId: commentId as string,
        linkId: linkId as string,
        expiresAt: expiresAt as number,
      }
    : null;
};

/**
 * Checks a token's signature, expiry and action. The signature is checked
 * first, and with `crypto.subtle.verify`, which compares in constant time, so
 * nothing about an unsigned payload is trusted or reported back.
 */
export const verifyLink = async (
  secret: string,
  token: string,
  expected: LinkAction,
  now: number,
): Promise<LinkCheck> => {
  if (token.length > MAX_TOKEN_LENGTH)
    return { ok: false, reason: 'malformed' };

  const parts = token.split('.');
  if (parts.length !== 2) return { ok: false, reason: 'malformed' };

  const [payloadText, signatureText] = parts as [string, string];
  const payload = fromBase64Url(payloadText);
  const signature = fromBase64Url(signatureText);
  if (!payload || !signature) return { ok: false, reason: 'malformed' };

  const authentic = await crypto.subtle.verify(
    'HMAC',
    await hmacKey(secret, 'verify'),
    signature,
    encoder.encode(payloadText),
  );
  if (!authentic) return { ok: false, reason: 'forged' };

  const claims = parseClaims(payload);
  if (!claims) return { ok: false, reason: 'malformed' };
  if (claims.action !== expected) return { ok: false, reason: 'wrong-action' };
  if (claims.expiresAt <= now) return { ok: false, reason: 'expired' };

  return { ok: true, claims };
};
