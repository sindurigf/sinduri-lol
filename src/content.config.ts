import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
// `astro:content` still re-exports `z`, but it is deprecated and goes away in
// Astro 8. `astro/zod` is the supported path to the same Zod instance.
import { z } from 'astro/zod';

export const BLOG_CONTENT_DIR = './src/content/blog';
export const BLOG_FILE_PATTERN = '**/*.md';

export const BLOG_CATEGORIES = [
  'skincare',
  'travel',
  'personal-thoughts',
  'professional-journey',
  'open-source',
] as const;

export type BlogCategory = (typeof BLOG_CATEGORIES)[number];

const blog = defineCollection({
  loader: glob({ base: BLOG_CONTENT_DIR, pattern: BLOG_FILE_PATTERN }),
  schema: ({ image }) =>
    z
      .object({
        title: z.string(),
        date: z.coerce.date(),
        category: z.enum(BLOG_CATEGORIES),
        /*
         * True while the post is lorem ipsum standing in for one not yet written.
         * Required, not defaulted, so a new post has to say which it is.
         * tests/llms-txt.spec.ts holds it to the text.
         */
        placeholder: z.boolean(),
        /*
         * Each tag is a URL segment on /blog/tag/<tag>/, so the shape is
         * enforced here rather than escaped at every use: kebab-case, no
         * leading, trailing or doubled hyphen.
         */
        tags: z
          .array(z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/))
          .default([]),
        teaser: z.string(),
        ogImage: z.string().optional(),
        featured: z.boolean().default(false),
        readingTime: z.number().optional(),
        seoTitle: z.string().optional(),
        seoDescription: z.string().optional(),
        /*
         * The photo on the post's card where a listing gives it the wide lead
         * treatment. A path relative to the post, so astro:assets resizes it.
         * Without one the card keeps its placeholder box.
         */
        cover: image().optional(),
        coverAlt: z.string().optional(),
      })
      .refine((post) => post.cover === undefined || Boolean(post.coverAlt), {
        message: 'A post with a cover needs coverAlt describing the photo.',
        path: ['coverAlt'],
      }),
});

export const collections = { blog };
