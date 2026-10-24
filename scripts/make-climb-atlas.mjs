#!/usr/bin/env node
/*
 * Writes the lossless WebP of the rabbit atlas the footer rabbit climbs in.
 * A raster decodes off the main thread; the SVG parses on it.
 *
 *   npm run climb-atlas
 */

import {
  CLIMB_ATLAS_TARGET,
  renderClimbAtlas,
} from '../src/lib/climb-atlas-render.ts';

const WEBP_EFFORT = 6;

await renderClimbAtlas()
  .webp({ lossless: true, effort: WEBP_EFFORT })
  .toFile(CLIMB_ATLAS_TARGET);
