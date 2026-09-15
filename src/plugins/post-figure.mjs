/*
 * Makes a markdown image responsive, and its title a visible caption.
 *
 * Astro renders `![alt](./photo.jpg)` as one WebP at the master's own width,
 * with no `srcset`. A post photo is drawn at most 768px wide, the `max-w-3xl`
 * measure in src/pages/blog/[slug].astro, and 273px at 305px, so one file is
 * either stretched on a 2x screen or several times too large on a phone, and
 * tests/image-size.spec.ts fails the second. Setting `layout` and `sizes` here
 * works because Astro's image marker runs after user hast plugins and passes
 * every property it finds on the `img` into `getImage()`.
 *
 * The title becomes a `figcaption`, because a photo credit has to be visible
 * and tied to its photo: a `title` attribute is neither, since touch and
 * keyboard users never see its tooltip. Write the credit as the title:
 *
 *   ![Alt text describing the photo](../../assets/blog/x.jpg "Photo: Name")
 *
 * Only an image alone in its paragraph becomes a figure; an image inside a
 * sentence keeps its title attribute and its paragraph.
 *
 * A credit naming someone in PHOTOGRAPHERS (src/lib/credits.ts) links their
 * name. The link sits in a line of text, so it takes the SC 2.5.8 inline
 * exception tests/target-size.spec.ts implements.
 */

import { PHOTOGRAPHERS, PHOTO_CREDIT_PREFIX } from '../lib/credits.ts';

/*
 * The prose measure, `max-w-3xl`, from the viewport where it fits inside the
 * gutter; the viewport net of the gutter below it.
 */
const SIZES =
  '(min-width: 51rem) 48rem, (min-width: 40rem) calc(100vw - 3rem), calc(100vw - 2rem)';

/*
 * `full-width` takes its candidates from `image.breakpoints` in
 * astro.config.mjs, which is WIDTHS from src/lib/image-densities.ts. A
 * `widths` array set here does not survive the hast tree; a string does.
 */
const LAYOUT = 'full-width';

const FIGURE_CLASS = 'post-figure';

const isElement = (node, tagName) =>
  node?.type === 'element' && node.tagName === tagName;

const text = (value) => ({ type: 'text', value });

const captionChildren = (caption) => {
  if (!caption.startsWith(PHOTO_CREDIT_PREFIX)) return [text(caption)];

  const name = caption.slice(PHOTO_CREDIT_PREFIX.length);
  const href = PHOTOGRAPHERS[name];
  if (href === undefined) return [text(caption)];

  return [
    text(PHOTO_CREDIT_PREFIX),
    {
      type: 'element',
      tagName: 'a',
      properties: { href },
      children: [text(name)],
    },
  ];
};

export const postFigure = {
  name: 'post-figure',

  element: {
    filter: ['img'],

    visit(node, ctx) {
      const { title, ...properties } = node.properties ?? {};
      const image = {
        type: 'element',
        tagName: 'img',
        properties: { ...properties, layout: LAYOUT, sizes: SIZES },
        children: [],
      };

      const parent = ctx.parent(node);
      const aloneInParagraph =
        isElement(parent, 'p') &&
        parent.children.length === 1 &&
        ctx.textContent(parent).trim() === '';

      const caption = typeof title === 'string' ? title.trim() : '';

      if (caption === '' || !aloneInParagraph) {
        ctx.setProperty(node, 'layout', LAYOUT);
        ctx.setProperty(node, 'sizes', SIZES);
        return;
      }

      ctx.replaceNode(parent, {
        type: 'element',
        tagName: 'figure',
        properties: { className: [FIGURE_CLASS] },
        children: [
          image,
          {
            type: 'element',
            tagName: 'figcaption',
            properties: {},
            children: captionChildren(caption),
          },
        ],
      });
    },
  },
};
