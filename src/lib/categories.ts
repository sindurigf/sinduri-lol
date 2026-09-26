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
    teaser: 'Skincare routines, products and what works for me.',
  },
  travel: {
    accent: ACCENTS.ink,
    glyph: '✈',
    teaser: 'Places I have travelled to, from Kerala to Vienna and beyond.',
  },
  'personal-thoughts': {
    accent: ACCENTS.pink,
    glyph: '❋',
    teaser: 'Kindness, empathy and whatever else is on my mind.',
  },
  'professional-journey': {
    accent: ACCENTS.gold,
    glyph: '◆',
    teaser:
      'From civil engineering to Drupal, and what I keep learning on the way.',
  },
  'open-source': {
    accent: ACCENTS.gold,
    glyph: '</>',
    teaser: 'Drupal, community events and why there is room for everyone.',
  },
} as const satisfies Record<BlogCategory, Category>;
