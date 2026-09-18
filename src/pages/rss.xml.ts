import type { APIRoute } from 'astro';
import { getSortedPosts } from '../lib/blog';
import { SITE_FEED_PATH, feedResponse } from '../lib/feed';

/* Every published post, newest first. See src/lib/feed.ts. */
export const GET: APIRoute = async ({ site }) =>
  feedResponse(
    {
      title: 'sinduri.lol',
      description: 'Every post on sinduri.lol, newest first.',
      pagePath: '/blog/',
      selfPath: SITE_FEED_PATH,
      posts: await getSortedPosts(),
    },
    site,
  );
