import type { APIRoute, GetStaticPaths } from 'astro';
import { getSortedPosts, type BlogPost } from '../../lib/blog';
import { markdownSource } from '../../lib/markdown-source';

/* /blog/<slug>.md for every published post. See src/lib/markdown-source.ts. */
export const getStaticPaths: GetStaticPaths = async () =>
  (await getSortedPosts())
    .filter((post) => !post.data.placeholder)
    .map((post) => ({ params: { slug: post.id }, props: { post } }));

export const GET: APIRoute = async ({ props, site }) => {
  if (!site) {
    throw new Error(
      'A Markdown source needs `site` in astro.config.mjs for absolute links.',
    );
  }
  return new Response(
    await markdownSource((props as { post: BlogPost }).post, site),
  );
};
