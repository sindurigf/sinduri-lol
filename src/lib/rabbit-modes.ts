/*
 * The rabbit art is drawn in the dark-mode red; each piece has a light copy
 * in the light-mode red, swapped by `data-theme` (src/styles/light-mode.css).
 */
import { cssColorToken } from './css-token.ts';

export const RABBIT_ART = [
  'src/assets/roundel-rabbit.svg',
  'src/assets/bunny-footer.svg',
  'src/assets/lepus-rabbit.svg',
  'src/assets/hero-rabbit.svg',
] as const;

export const DARK_ART_RED = '--color-bunny';
export const LIGHT_ART_RED = '--color-light-red-text';

export const lightArtPath = (dark: string): string =>
  dark.replace(/\.svg$/, '-light.svg');

export const lightArt = (svg: string): string => {
  const dark = cssColorToken(DARK_ART_RED);
  if (!svg.includes(dark))
    throw new Error(`rabbit-modes: the art has no ${dark}; was it redrawn?`);
  return svg.replaceAll(dark, cssColorToken(LIGHT_ART_RED));
};
