#!/usr/bin/env node
/*
 * Renders the rabbit atlas (src/assets/hero-rabbit.svg) to the lossless WebP the
 * footer rabbit climbs in. A raster decodes off the main thread; the SVG parses on it.
 *
 *   npm run climb-atlas
 */

import sharp from 'sharp';
import { ATLAS_SIZE } from '../src/lib/hero-field-rabbit.ts';

const SOURCE = 'src/assets/hero-rabbit.svg';
const TARGET = 'src/assets/hero-rabbit-climb.webp';
/* Rendered at four times its size, then scaled down, so curved edges are smooth. */
const SUPERSAMPLE = 4;
const SVG_DPI = 72;
const WEBP_EFFORT = 6;

await sharp(SOURCE, { density: SVG_DPI * SUPERSAMPLE })
  .resize(ATLAS_SIZE.w, ATLAS_SIZE.h, { kernel: 'lanczos3' })
  .webp({ lossless: true, effort: WEBP_EFFORT })
  .toFile(TARGET);
