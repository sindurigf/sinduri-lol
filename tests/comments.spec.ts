import { createServer, type Server } from 'node:http';
import { expect, test, type APIRequestContext } from '@playwright/test';
import {
  COMMENTS_EXPORT_KEY,
  COMMENTS_SIGNING_KEY,
  DEPLOY_HOOK_PATH,
  DEPLOY_HOOK_PORT,
} from '../playwright.worker.config';
import {
  COMMENT_LIMITS,
  OWNER_NAME,
  validateComment,
  validateOwnerReply,
} from '../src/lib/comment-form';
import {
  MODERATION_LINK_DAYS,
  newLinkClaims,
  signLink,
  verifyLink,
  type LinkAction,
} from '../src/lib/comment-links';
import {
  EMAIL_RETENTION_DAYS,
  PENDING_RETENTION_DAYS,
} from '../src/lib/comment-retention';
import {
  DAY_MS,
  SCHEDULED_HANDLER,
  localD1,
  localD1Rows,
  poll,
  sameOrigin,
  wranglerConfig,
} from './worker-requests';

/**
 * The comment moderation routes: /comments/review/, /comments/reply/ and
 * /comments/export, plus the retention sweep's comment half.
 *
 * Run under playwright.worker.config.ts, through the Worker with local D1, so
 * every approval, rejection and reply is a real row change. The deploy hook
 * points at a stub server started here, which counts the rebuilds requested.
 *
 * Comments are inserted straight into local D1: the public form that creates
 * them is not built yet, and moderation is what this file is about.
 *
 * VERIFIED NOT TO BE VACUOUS, 2026-09-15, by breaking each rule in turn:
 *
 *   - dropping claimLink from the batch in comment-store.ts's `moderate` fails
 *     "a used review link cannot be used again": the reused link got a 200
 *     instead of a 410;
 *   - selecting `email` in listApprovedComments and returning it fails "the
 *     export returns approved comments without email" on the key list;
 *   - removing `status = 'approved'` from the same query fails the same test
 *     on the pending comment's id appearing;
 *   - replacing applyPrivateHeaders with applyGlobalHeaders in review.astro
 *     fails "a review link shows the comment and changes nothing": expected
 *     X-Robots-Tag `noindex`, received undefined;
 *   - approving on a GET in review.astro fails the same test at the status,
 *     the mail-scanner case the page is shaped around.
 */

const REVIEW = '/comments/review/';
const REPLY = '/comments/reply/';
const EXPORT = '/comments/export';

const OTHER_KEY = 'a-different-signing-key-'.padEnd(32, 'y');
const POST_SLUG = 'open-source-is-not-just-code';

interface Row {
  id: string;
  parent_id: string | null;
  name: string;
  email: string | null;
  status: string;
  is_owner: number;
  post_slug: string;
}

const quote = (value: string): string => `'${value.replaceAll("'", "''")}'`;

const insertComment = (options: {
  status?: 'pending' | 'approved';
  parentId?: string | null;
  email?: string | null;
  createdAt?: number;
}): string => {
  const id = crypto.randomUUID();
  const createdAt = options.createdAt ?? Date.now();
  const email =
    options.email === undefined ? 'reader@example.com' : options.email;
  localD1(
    'INSERT INTO comments (id, post_slug, parent_id, name, email, body, status, is_owner, created_at, approved_at) VALUES (' +
      [
        quote(id),
        quote(POST_SLUG),
        options.parentId ? quote(options.parentId) : 'NULL',
        quote('Grace Hopper'),
        email === null ? 'NULL' : quote(email),
        quote(`Comment body ${id}`),
        quote(options.status ?? 'pending'),
        '0',
        String(createdAt),
        options.status === 'approved' ? String(createdAt) : 'NULL',
      ].join(', ') +
      ')',
  );
  return id;
};

const commentRow = (id: string): Row | undefined =>
  localD1Rows<Row>(
    `SELECT id, parent_id, name, email, status, is_owner, post_slug FROM comments WHERE id = ${quote(id)}`,
  )[0];

const linkFor = async (
  action: LinkAction,
  commentId: string,
  options: { key?: string; now?: number } = {},
): Promise<string> =>
  signLink(
    options.key ?? COMMENTS_SIGNING_KEY,
    newLinkClaims(action, commentId, options.now ?? Date.now()),
  );

const open = (
  request: APIRequestContext,
  baseURL: string,
  page: string,
  token: string,
) =>
  request.get(`${page}?link=${encodeURIComponent(token)}`, {
    maxRedirects: 0,
    headers: sameOrigin(baseURL),
  });

const submit = (
  request: APIRequestContext,
  baseURL: string,
  page: string,
  form: Record<string, string>,
) =>
  request.post(page, {
    form,
    maxRedirects: 0,
    headers: sameOrigin(baseURL),
  });

let hookServer: Server;
let hookCalls = 0;

test.beforeAll(async () => {
  hookServer = createServer((incoming, outgoing) => {
    if (incoming.method === 'POST' && incoming.url === DEPLOY_HOOK_PATH) {
      hookCalls += 1;
    }
    outgoing.writeHead(200, { 'Content-Type': 'application/json' });
    outgoing.end('{"success":true}');
  });
  await new Promise<void>((ready) =>
    hookServer.listen(DEPLOY_HOOK_PORT, '127.0.0.1', ready),
  );
});

test.afterAll(async () => {
  await new Promise((closed) => hookServer.close(closed));
});

/* Serially: the tests share the store and count calls to one hook. */
test.describe.configure({ mode: 'serial' });

test.describe('moderation links', () => {
  test('a signed link verifies, and an edited, foreign or expired one does not', async () => {
    const now = Date.now();
    const commentId = crypto.randomUUID();
    const token = await linkFor('review', commentId, { now });

    const verified = await verifyLink(
      COMMENTS_SIGNING_KEY,
      token,
      'review',
      now,
    );
    expect(verified.ok, 'a freshly signed link should verify.').toBe(true);

    const [payload, signature] = token.split('.');
    const edited = `${payload!.slice(0, -2)}AA.${signature}`;
    expect(
      await verifyLink(COMMENTS_SIGNING_KEY, edited, 'review', now),
      'a link whose payload was edited kept a valid signature.',
    ).toEqual({ ok: false, reason: 'forged' });

    expect(
      await verifyLink(
        COMMENTS_SIGNING_KEY,
        await linkFor('review', commentId, { key: OTHER_KEY, now }),
        'review',
        now,
      ),
      'a link signed with another key verified.',
    ).toEqual({ ok: false, reason: 'forged' });

    expect(
      await verifyLink(COMMENTS_SIGNING_KEY, token, 'reply', now),
      'a review link was accepted as a reply link.',
    ).toEqual({ ok: false, reason: 'wrong-action' });

    expect(
      await verifyLink(
        COMMENTS_SIGNING_KEY,
        token,
        'review',
        now + MODERATION_LINK_DAYS * DAY_MS + 1,
      ),
      `a link still worked after ${MODERATION_LINK_DAYS} days.`,
    ).toEqual({ ok: false, reason: 'expired' });

    expect(
      await verifyLink(COMMENTS_SIGNING_KEY, 'not a token', 'review', now),
    ).toEqual({ ok: false, reason: 'malformed' });
  });
});

test.describe('comment validation', () => {
  const form = (fields: Record<string, string>): FormData => {
    const data = new FormData();
    for (const [key, value] of Object.entries(fields)) data.set(key, value);
    return data;
  };

  test('email is optional, and a given one has to look like an address', () => {
    const withoutEmail = validateComment(
      form({ name: 'Grace', email: '', comment: 'Hello there' }),
    );
    expect(withoutEmail).toEqual({
      ok: true,
      value: { name: 'Grace', email: null, body: 'Hello there' },
    });

    const badEmail = validateComment(
      form({ name: '', email: 'grace', comment: '' }),
    );
    expect(
      badEmail.ok ? [] : badEmail.errors.map((error) => error.field),
      'every failing field should be reported at once.',
    ).toEqual(['name', 'email', 'body']);
  });

  test('an owner reply needs a body within the limits', () => {
    expect(validateOwnerReply(form({ comment: '' })).ok).toBe(false);
    expect(
      validateOwnerReply(
        form({ comment: 'x'.repeat(COMMENT_LIMITS.bodyMax + 1) }),
      ).ok,
    ).toBe(false);
    expect(validateOwnerReply(form({ comment: 'Thank you!' }))).toEqual({
      ok: true,
      value: 'Thank you!',
    });
  });
});

test.describe('the review page', () => {
  test('every comment route runs the Worker first', () => {
    const listed = wranglerConfig().assets?.run_worker_first ?? [];
    for (const path of [REVIEW, REPLY, EXPORT]) {
      expect(
        listed,
        `${path} is not in run_worker_first, so a browser navigation to it is ` +
          'answered by the asset layer and never reaches the route.',
      ).toContain(path);
    }
  });

  test('a review link shows the comment and changes nothing', async ({
    request,
    baseURL,
  }) => {
    const id = insertComment({});
    const response = await open(
      request,
      baseURL!,
      REVIEW,
      await linkFor('review', id),
    );

    expect(response.status()).toBe(200);
    expect(
      commentRow(id)?.status,
      'opening a review link approved the comment. Mail scanners open every ' +
        'link on arrival, so a GET must never act.',
    ).toBe('pending');

    const html = await response.text();
    expect(html).toContain(`Comment body ${id}`);
    expect(html).toContain('reader@example.com');
    expect(html).toContain('Approve and publish');

    const headers = response.headers();
    expect(headers['x-robots-tag']).toBe('noindex');
    expect(headers['cache-control']).toContain('no-store');
    /*
     * Exactly this value. The page URL carries a working link, so a Referer
     * must not repeat it; `no-referrer` would also hide the Origin of the
     * page's own form POST, which Astro's CSRF check then refuses with a 403
     * that sameOrigin() above cannot show, because it sets Origin by hand.
     */
    expect(
      headers['referrer-policy'],
      'the referrer policy must send the origin and never the path: ' +
        'no-referrer breaks the buttons, same-origin leaks the link.',
    ).toBe('strict-origin');
    expect(headers['content-security-policy']).toContain("default-src 'self'");
    expect(
      html,
      'the visit counter reports the full URL, link included, to Umami.',
    ).not.toContain('umami.js');
  });

  test('approving publishes the comment and requests a rebuild', async ({
    request,
    baseURL,
  }) => {
    const id = insertComment({});
    const callsBefore = hookCalls;

    const response = await submit(request, baseURL!, REVIEW, {
      link: await linkFor('review', id),
      decision: 'approve',
    });

    expect(response.status()).toBe(303);
    expect(response.headers()['location']).toBe(
      `${REVIEW}?done=approve&rebuild=started`,
    );
    expect(commentRow(id)?.status).toBe('approved');
    expect(
      hookCalls - callsBefore,
      'an approval should request exactly one rebuild, or the comment never ' +
        'reaches the static post.',
    ).toBe(1);
  });

  test('a used review link cannot be used again', async ({
    request,
    baseURL,
  }) => {
    const id = insertComment({});
    const token = await linkFor('review', id);

    const first = await submit(request, baseURL!, REVIEW, {
      link: token,
      decision: 'approve',
    });
    expect(first.status()).toBe(303);

    const again = await open(request, baseURL!, REVIEW, token);
    expect(
      again.status(),
      'a used link opened its page again. Anyone holding a copy, from a log ' +
        'or a forwarded email, could act with it.',
    ).toBe(410);
    expect(await again.text()).toContain('already been used');
  });

  test('rejecting deletes the comment without a rebuild', async ({
    request,
    baseURL,
  }) => {
    const id = insertComment({});
    const callsBefore = hookCalls;

    const response = await submit(request, baseURL!, REVIEW, {
      link: await linkFor('review', id),
      decision: 'reject',
    });

    expect(response.status()).toBe(303);
    expect(response.headers()['location']).toBe(`${REVIEW}?done=reject`);
    expect(commentRow(id), 'a rejected comment was kept.').toBeUndefined();
    expect(hookCalls - callsBefore).toBe(0);
  });

  test('a forged or expired link is refused', async ({ request, baseURL }) => {
    const id = insertComment({});

    const forged = await open(
      request,
      baseURL!,
      REVIEW,
      await linkFor('review', id, { key: OTHER_KEY }),
    );
    expect(forged.status()).toBe(400);

    const expired = await open(
      request,
      baseURL!,
      REVIEW,
      await linkFor('review', id, {
        now: Date.now() - (MODERATION_LINK_DAYS * DAY_MS + DAY_MS),
      }),
    );
    expect(expired.status()).toBe(410);

    const forgedPost = await submit(request, baseURL!, REVIEW, {
      link: await linkFor('review', id, { key: OTHER_KEY }),
      decision: 'approve',
    });
    expect(forgedPost.status()).toBe(400);
    expect(commentRow(id)?.status).toBe('pending');
  });
});

test.describe('the owner reply page', () => {
  test('a reply is published as the owner and approves its comment', async ({
    request,
    baseURL,
  }) => {
    const parentId = insertComment({});
    const callsBefore = hookCalls;
    const body = `Owner reply ${crypto.randomUUID()}`;

    const response = await submit(request, baseURL!, REPLY, {
      link: await linkFor('reply', parentId),
      comment: body,
    });

    expect(response.status()).toBe(303);
    expect(response.headers()['location']).toBe(
      `${REPLY}?done=reply&rebuild=started`,
    );

    expect(
      commentRow(parentId)?.status,
      'replying to a pending comment should publish it too.',
    ).toBe('approved');

    const [reply] = localD1Rows<Row>(
      `SELECT id, parent_id, name, email, status, is_owner, post_slug FROM comments WHERE body = ${quote(body)}`,
    );
    expect(reply).toMatchObject({
      parent_id: parentId,
      name: OWNER_NAME,
      email: null,
      status: 'approved',
      is_owner: 1,
      post_slug: POST_SLUG,
    });
    expect(hookCalls - callsBefore).toBe(1);
  });

  test('a reply to a reply joins the top-level thread', async ({
    request,
    baseURL,
  }) => {
    const rootId = insertComment({ status: 'approved' });
    const childId = insertComment({ status: 'approved', parentId: rootId });
    const body = `Nested reply ${crypto.randomUUID()}`;

    const response = await submit(request, baseURL!, REPLY, {
      link: await linkFor('reply', childId),
      comment: body,
    });
    expect(response.status()).toBe(303);

    const [reply] = localD1Rows<Row>(
      `SELECT id, parent_id, name, email, status, is_owner, post_slug FROM comments WHERE body = ${quote(body)}`,
    );
    expect(
      reply?.parent_id,
      'threads are one level deep, so a reply to a reply belongs to the ' +
        'top-level comment.',
    ).toBe(rootId);
  });

  test('an empty reply is refused, keeps the link usable and publishes nothing', async ({
    request,
    baseURL,
  }) => {
    const parentId = insertComment({});
    const token = await linkFor('reply', parentId);

    const response = await submit(request, baseURL!, REPLY, {
      link: token,
      comment: '',
    });

    expect(response.status()).toBe(422);
    const html = await response.text();
    expect(html).toContain('aria-invalid="true"');
    expect(html).toContain('Write a comment.');
    expect(commentRow(parentId)?.status).toBe('pending');

    const retry = await open(request, baseURL!, REPLY, token);
    expect(
      retry.status(),
      'a rejected reply used up the link, so a typo would lock the owner out.',
    ).toBe(200);
  });
});

test.describe('the export', () => {
  test('refuses a request without the key', async ({ request }) => {
    expect((await request.get(EXPORT)).status()).toBe(401);
    expect(
      (
        await request.get(EXPORT, {
          headers: { Authorization: `Bearer ${OTHER_KEY}` },
        })
      ).status(),
    ).toBe(401);
  });

  test('the export returns approved comments without email', async ({
    request,
  }) => {
    const approvedId = insertComment({ status: 'approved' });
    const pendingId = insertComment({});

    const response = await request.get(EXPORT, {
      headers: { Authorization: `Bearer ${COMMENTS_EXPORT_KEY}` },
    });

    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('application/json');
    expect(response.headers()['cache-control']).toContain('no-store');

    const { comments } = (await response.json()) as {
      comments: Record<string, unknown>[];
    };
    const ids = comments.map((comment) => comment['id']);

    expect(ids).toContain(approvedId);
    expect(ids, 'a pending comment was exported for publishing.').not.toContain(
      pendingId,
    );
    for (const comment of comments) {
      expect(
        Object.keys(comment).sort(),
        'the export must carry public fields only. Anything it returns is ' +
          'rendered into a static page.',
      ).toEqual([
        'body',
        'createdAt',
        'id',
        'isOwner',
        'name',
        'parent',
        'post',
      ]);
    }
    expect(JSON.stringify(comments)).not.toContain('reader@example.com');
  });
});

test.describe('comment retention', () => {
  test(`emails clear after ${EMAIL_RETENTION_DAYS} days and unmoderated comments go after ${PENDING_RETENTION_DAYS}`, async ({
    request,
  }) => {
    const now = Date.now();
    const oldApproved = insertComment({
      status: 'approved',
      createdAt: now - (EMAIL_RETENTION_DAYS + 1) * DAY_MS,
    });
    const recentApproved = insertComment({
      status: 'approved',
      createdAt: now - DAY_MS,
    });
    const stalePending = insertComment({
      createdAt: now - (PENDING_RETENTION_DAYS + 1) * DAY_MS,
    });
    const freshPending = insertComment({ createdAt: now - DAY_MS });

    expect((await request.get(SCHEDULED_HANDLER)).status()).toBe(200);

    const swept = await poll(() =>
      commentRow(stalePending) === undefined ? true : undefined,
    );
    expect(
      swept,
      `a comment left pending over ${PENDING_RETENTION_DAYS} days survived the sweep.`,
    ).toBe(true);

    expect(
      commentRow(oldApproved),
      'the sweep deleted a published comment; only its email should go.',
    ).toMatchObject({ status: 'approved', email: null });
    expect(commentRow(recentApproved)?.email).toBe('reader@example.com');
    expect(commentRow(freshPending)?.status).toBe('pending');
  });
});
