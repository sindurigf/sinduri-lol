import type { ImageMetadata } from 'astro';
import { getImage } from 'astro:assets';
import type { BlogPost } from './blog';

/*
 * A post's Markdown, served beside the page at /blog/<slug>.md for readers
 * that want the text rather than the HTML: the "Markdown source endpoints"
 * item of specification.website's Agent Readiness group, and the `.md`
 * convention of llmstxt.org. The page links it with
 * `<link rel="alternate" type="text/markdown">`.
 *
 * The body is the one the page is rendered from, with two rewrites so it
 * still works away from the repository. Images point into src/assets relative
 * to the post file, which means nothing to a reader, so each becomes the URL
 * of a built WebP. And root-relative links become absolute, for the reason
 * llms.txt's are: a file handed around as text has no origin to resolve
 * against.
 */

export const markdownSourcePath = (slug: string): string => `/blog/${slug}.md`;

/** Wide enough for the post column at 2x; the page's own images top out here. */
const SOURCE_IMAGE_WIDTH = 1200;

const POST_IMAGES = import.meta.glob<{ default: ImageMetadata }>(
  '../assets/blog/**/*.{jpg,jpeg,png,webp}',
  { eager: true },
);

const imageFor = (relativePath: string): ImageMetadata => {
  const key = relativePath.replace(/^(\.\.\/)+assets\//, '../assets/');
  const image = POST_IMAGES[key]?.default;
  if (!image) {
    throw new Error(
      `A post links ${relativePath}, which is not under src/assets/blog/.`,
    );
  }
  return image;
};

const builtImageUrl = async (
  relativePath: string,
  site: URL,
): Promise<string> => {
  /*
   * No read of `image.width` or any other field here: in a static build each
   * imported image is a proxy that marks its original for shipping on any
   * property read, and reading one put 2.6 MB of full-size photos into
   * dist/. The image service does not enlarge, so the width needs no cap.
   */
  const built = await getImage({
    src: imageFor(relativePath),
    width: SOURCE_IMAGE_WIDTH,
    format: 'webp',
  });
  return new URL(built.src, site).href;
};

const IMAGE = /!\[([^\]]*)\]\((\.\.\/[^)\s]+)((?:\s+'[^']*')?)\)/g;
const ROOT_RELATIVE_LINK = /\]\((\/[^)\s]*)/g;

const rewriteBody = async (body: string, site: URL): Promise<string> => {
  let out = body;
  for (const match of body.matchAll(IMAGE)) {
    const [whole, alt, path, title] = match;
    const url = await builtImageUrl(path!, site);
    out = out.replace(whole, `![${alt}](${url}${title})`);
  }
  return out.replace(
    ROOT_RELATIVE_LINK,
    (_, path: string) => `](${new URL(path, site).href}`,
  );
};

/* JSON strings are valid YAML double-quoted scalars, escapes included. */
const yaml = (value: string): string => JSON.stringify(value);

export const markdownSource = async (
  post: BlogPost,
  site: URL,
): Promise<string> => {
  const { title, date, category, tags, teaser } = post.data;
  const frontmatter = [
    '---',
    `title: ${yaml(title)}`,
    `date: ${date.toISOString().slice(0, 10)}`,
    `category: ${yaml(category)}`,
    `tags: [${tags.map(yaml).join(', ')}]`,
    `description: ${yaml(teaser)}`,
    `canonical: ${yaml(new URL(`/blog/${post.id}/`, site).href)}`,
    '---',
  ].join('\n');
  return `${frontmatter}\n\n${await rewriteBody(post.body ?? '', site)}`;
};
