import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

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
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    category: z.enum(BLOG_CATEGORIES),
    tags: z.array(z.string()).default([]),
    teaser: z.string(),
    ogImage: z.string().optional(),
    featured: z.boolean().default(false),
    readingTime: z.number().optional(),
    seoTitle: z.string().optional(),
    seoDescription: z.string().optional(),
  }),
});

export const collections = { blog };
