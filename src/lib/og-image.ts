import { readFileSync } from 'node:fs';
import {
  OG_CARD_MANIFEST,
  ogCardPath,
  ogRoute,
  type OgCardManifest,
} from './og-cards';

/*
 * 1.91:1, the large-card crop of Facebook, LinkedIn and X; every card is
 * drawn at it. tests/seo.spec.ts checks every declared size against its file.
 */
const CARD_WIDTH = 1200;
const CARD_HEIGHT = 630;

export interface OgImage {
  /** Root-relative; BaseLayout makes it absolute against `site`. */
  src: string;
  width: number;
  height: number;
  alt: string;
}

export const DEFAULT_OG_IMAGE: OgImage = {
  src: '/images/og-default.png',
  width: CARD_WIDTH,
  height: CARD_HEIGHT,
  alt: 'Sinduri Guntupalli, open source enthusiast and positivity advocate, beside the sinduri.lol bunny logo.',
};

/* Read at build time from public/; scripts/make-og.mjs writes it. */
const CARDS: OgCardManifest = JSON.parse(
  readFileSync(`public/${OG_CARD_MANIFEST}`, 'utf8'),
);

/**
 * The page's own card, or the site card for a page `npm run og` has not drawn
 * yet: the card is drawn from the built page, so a new page can only have one
 * after a build. tests/seo.spec.ts fails until it is drawn.
 */
export const pageOgImage = (pathname: string): OgImage => {
  const route = ogRoute(pathname);
  const card = CARDS[route];
  return card
    ? {
        src: `/${ogCardPath(route)}`,
        width: CARD_WIDTH,
        height: CARD_HEIGHT,
        alt: card.alt,
      }
    : DEFAULT_OG_IMAGE;
};
