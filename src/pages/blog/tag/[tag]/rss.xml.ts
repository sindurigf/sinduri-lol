import type { APIRoute, GetStaticPaths } from 'astro';
import {
  getPostsByTag,
  tagHref,
  tagLabel,
  type BlogPost,
} from '../../../../lib/blog';
import { feedResponse, tagFeedPath } from '../../../../lib/feed';

/*
 * One feed per tag in use, beside the tag's listing page. The drupal feed is
 * the one Drupal Planet subscribes to; see src/lib/feed.ts.
 */
export const getStaticPaths: GetStaticPaths = async () =>
  [...(await getPostsByTag())].map(([tag, posts]) => ({
    params: { tag },
    props: { posts },
  }));

export const GET: APIRoute = ({ params, props, site }) => {
  const { tag } = params;
  if (!tag) throw new Error('Tag feed rendered without a tag param.');

  return feedResponse(
    {
      title: `sinduri.lol: ${tagLabel(tag)}`,
      description: `Posts on sinduri.lol tagged ${tagLabel(tag)}, newest first.`,
      pagePath: tagHref(tag),
      selfPath: tagFeedPath(tag),
      posts: (props as { posts: BlogPost[] }).posts,
    },
    site,
  );
};
