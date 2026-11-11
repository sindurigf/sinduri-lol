/*
 * Renders the rabbit atlas (src/assets/hero-rabbit.svg) at the atlas's size for
 * Let It Fall's climb: drawn at four times its size, then scaled down, so curved edges are smooth.
 */
import sharp, { type Sharp } from 'sharp';
import { ATLAS_SIZE } from './rabbit-atlas.ts';

/* Source SVG to target WebP, one per mode (src/lib/rabbit-modes.ts). */
export const CLIMB_ATLASES = [
  ['src/assets/hero-rabbit.svg', 'src/assets/hero-rabbit-climb.webp'],
  [
    'src/assets/hero-rabbit-light.svg',
    'src/assets/hero-rabbit-climb-light.webp',
  ],
] as const;
const SVG_DPI = 72;
const SUPERSAMPLE = 4;

export const renderClimbAtlas = (source: string): Sharp =>
  sharp(source, { density: SVG_DPI * SUPERSAMPLE }).resize(
    ATLAS_SIZE.w,
    ATLAS_SIZE.h,
    { kernel: 'lanczos3' },
  );
