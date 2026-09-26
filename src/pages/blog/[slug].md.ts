import type { APIRoute, GetStaticPaths, InferGetStaticPropsType } from 'astro';
import { getSortedPosts } from '../../lib/blog';
import { markdownSource } from '../../lib/markdown-source';

export const getStaticPaths = (async () =>
  (await getSortedPosts()).map((post) => ({
    params: { slug: post.id },
    props: { post },
  }))) satisfies GetStaticPaths;

type Props = InferGetStaticPropsType<typeof getStaticPaths>;

export const GET: APIRoute<Props> = async ({ props, site }) => {
  if (!site) {
    throw new Error(
      'A Markdown source needs `site` in astro.config.mjs for absolute links.',
    );
  }
  return new Response(await markdownSource(props.post, site));
};
