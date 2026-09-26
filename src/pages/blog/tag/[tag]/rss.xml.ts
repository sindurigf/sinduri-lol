import type { APIRoute, GetStaticPaths, InferGetStaticPropsType } from 'astro';
import { getPostsByTag, tagLabel } from '../../../../lib/blog';
import { feedResponse, tagFeedTitle } from '../../../../lib/feed';
import { tagFeedPath, tagHref } from '../../../../lib/paths';

/* The drupal tag feed is the one Drupal Planet subscribes to. */
export const getStaticPaths = (async () =>
  [...(await getPostsByTag())].map(([tag, posts]) => ({
    params: { tag },
    props: { tag, posts },
  }))) satisfies GetStaticPaths;

type Props = InferGetStaticPropsType<typeof getStaticPaths>;

export const GET: APIRoute<Props> = ({ props: { tag, posts }, site }) =>
  feedResponse(
    {
      title: tagFeedTitle(tag),
      description: `Posts on sinduri.lol tagged ${tagLabel(tag)}, newest first.`,
      pagePath: tagHref(tag),
      selfPath: tagFeedPath(tag),
      posts,
    },
    site,
  );
