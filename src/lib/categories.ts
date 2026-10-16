import type { BlogCategory } from '../content.config';

/* Every category takes the gold register (docs/STYLEGUIDE.md row 5), so none drifts apart. */
export const CATEGORY_LABEL = 'text-gold';
export const CATEGORY_TILE = 'bg-gold text-gold-text';

interface Category {
  readonly glyph: string;
  /** Sinduri's copy from /about; also the category page's meta description. */
  readonly teaser: string;
}

export const CATEGORIES = {
  skincare: {
    glyph: '✦',
    teaser: 'The skincare routines and products that work for my skin.',
  },
  travel: {
    glyph: '✈',
    teaser: 'Slow holidays, good food and places that surprise me.',
  },
  'personal-thoughts': {
    glyph: '❋',
    teaser: 'My thoughts on kindness, empathy and the people around me.',
  },
  'professional-journey': {
    glyph: '◆',
    teaser:
      'From civil engineering to development, product management and developer programs.',
  },
  'open-source': {
    glyph: '</>',
    teaser:
      'Drupal, community events and what makes open source communities last.',
  },
} as const satisfies Record<BlogCategory, Category>;
