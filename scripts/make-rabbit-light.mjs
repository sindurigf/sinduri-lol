#!/usr/bin/env node
/*
 * Writes the light-mode copy of each piece of rabbit art. Run after
 * scripts/make-logo.mjs or a new trace.
 *
 *   npm run rabbit-light
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { RABBIT_ART, lightArt, lightArtPath } from '../src/lib/rabbit-modes.ts';

for (const file of RABBIT_ART)
  writeFileSync(lightArtPath(file), lightArt(readFileSync(file, 'utf8')));
