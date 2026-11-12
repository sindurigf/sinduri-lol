#!/usr/bin/env node
/*
 * Writes the lossless WebPs, dark and light, of the rabbit atlas the footer rabbit climbs in.
 * A raster decodes off the main thread; the SVG parses on it.
 *
 *   npm run climb-atlas
 */

import {
  CLIMB_ATLASES,
  renderClimbAtlas,
} from '../src/lib/climb-atlas-render.ts';

const WEBP_EFFORT = 6;

for (const [source, target] of CLIMB_ATLASES)
  await renderClimbAtlas(source)
    .webp({ lossless: true, effort: WEBP_EFFORT })
    .toFile(target);
