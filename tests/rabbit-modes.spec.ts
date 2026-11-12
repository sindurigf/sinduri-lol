import { readFileSync } from 'node:fs';
import { expect, test } from './test';
import { NODE } from './tags';
import { RABBIT_ART, lightArt, lightArtPath } from '../src/lib/rabbit-modes';

/* Build correctness: each light rabbit is its dark twin with the light pink (npm run rabbit-light). */
test.describe('the rabbit art in both modes', NODE, () => {
  for (const dark of RABBIT_ART) {
    test(`${lightArtPath(dark)} is redrawn from ${dark}`, () => {
      expect(
        readFileSync(lightArtPath(dark), 'utf8'),
        `${lightArtPath(dark)} is stale: run npm run rabbit-light`,
      ).toBe(lightArt(readFileSync(dark, 'utf8')));
    });
  }
});
