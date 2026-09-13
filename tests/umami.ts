import type { BrowserContext } from '@playwright/test';
import { UMAMI_HOST_URL } from '../src/lib/analytics';

/**
 * A stand-in for Umami's collector, shared by tests/analytics.spec.ts and
 * tests/console.spec.ts.
 *
 * Nothing in the suite may reach the real one: a test page view is a page view
 * in Sinduri's dashboard. It answers the way the collector does, including the
 * CORS preflight the tracker's JSON body and `x-umami-*` headers trigger, so
 * the browser treats the exchange as a success rather than logging a failure.
 *
 * Routed on the context, not the page, because a click event is sent with
 * `keepalive` as the page navigates away, and a page route goes with the page.
 */

export type UmamiSend = { type: string; payload: Record<string, unknown> };

const CORS_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': '*',
  'access-control-allow-methods': 'POST, OPTIONS',
};

export const fakeCollector = async (
  context: BrowserContext,
): Promise<UmamiSend[]> => {
  const sent: UmamiSend[] = [];

  await context.route(`${UMAMI_HOST_URL}/**`, async (route) => {
    const request = route.request();

    if (request.method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: CORS_HEADERS });
      return;
    }

    sent.push(request.postDataJSON() as UmamiSend);
    await route.fulfill({ status: 200, headers: CORS_HEADERS, json: {} });
  });

  return sent;
};
