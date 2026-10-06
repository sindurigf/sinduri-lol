import type { BlogCategory } from '../content.config';

/*
 * Full class names: Tailwind cannot see a composed `text-${accent}`. No cyan,
 * which is reserved for focus and hover. Ratios: docs/STYLEGUIDE.md#contrast.
 */
const ACCENTS = {
  gold: {
    text: 'text-gold',
    tile: 'bg-gold text-gold-text',
  },
  ink: {
    text: 'text-text',
    tile: 'bg-text text-background',
  },
  pink: {
    text: 'text-pink-text',
    tile: 'bg-bunny text-background',
  },
} as const;

type CategoryAccent = (typeof ACCENTS)[keyof typeof ACCENTS];

interface Category {
  readonly accent: CategoryAccent;
  readonly glyph: string;
  /** Sinduri's copy from /about; also the category page's meta description. */
  readonly teaser: string;
}

export const CATEGORIES = {
  skincare: {
    accent: ACCENTS.ink,
    glyph: '✦',
    teaser: 'The skincare routines and products that work for my skin.',
  },
  travel: {
    accent: ACCENTS.ink,
    glyph: '✈',
    teaser: 'Slow holidays, good food and places that surprise me.',
  },
  'personal-thoughts': {
    accent: ACCENTS.pink,
    glyph: '❋',
    teaser: 'My thoughts on kindness, empathy and the people around me.',
  },
  'professional-journey': {
    accent: ACCENTS.gold,
    glyph: '◆',
    teaser:
      'From civil engineering to development, product management and developer programs.',
  },
  'open-source': {
    accent: ACCENTS.gold,
    glyph: '</>',
    teaser:
      'Drupal, community events and what makes open source communities last.',
  },
} as const satisfies Record<BlogCategory, Category>;
