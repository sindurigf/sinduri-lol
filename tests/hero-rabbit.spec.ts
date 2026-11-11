import sharp from 'sharp';
import { expect, test } from './test';
import { readFileSync } from 'node:fs';
import { ATLAS_SIZE, RABBIT_FRAMES } from '../src/lib/rabbit-atlas';
import { CLIMB_ATLASES, renderClimbAtlas } from '../src/lib/climb-atlas-render';
import { NODE } from './tags';

/* Mean difference per channel, out of 255, allowed between the raster and a fresh render of the SVG. */
const RENDER_DRIFT = 2;
const WEBP_LOSSLESS = 'VP8L';
const CHUNK_AT = 12;
const CHUNK_TAG = 4;

/* Performance and build correctness: Let It Fall's climb draws a lossless raster of the same atlas, which decodes off the main thread. */
for (const [source, target] of CLIMB_ATLASES)
  test.describe(`the climb atlas ${target}`, NODE, () => {
    test('is lossless WebP at the atlas size', async () => {
      const file = readFileSync(target);
      expect(
        file.subarray(CHUNK_AT, CHUNK_AT + CHUNK_TAG).toString(),
        'the climb atlas is not lossless WebP',
      ).toBe(WEBP_LOSSLESS);
      const { width = 0, height = 0 } = await sharp(file).metadata();
      expect(
        { width, height },
        'the climb atlas and ATLAS_SIZE disagree',
      ).toEqual({
        width: ATLAS_SIZE.w,
        height: ATLAS_SIZE.h,
      });
    });

    test('matches the vector atlas, so it is redrawn with it (npm run climb-atlas)', async () => {
      const fresh = await renderClimbAtlas(source)
        .ensureAlpha()
        .raw()
        .toBuffer();
      const kept = await sharp(target).ensureAlpha().raw().toBuffer();
      expect(kept.length, 'the climb atlas has a different size').toBe(
        fresh.length,
      );
      let drift = 0;
      for (let i = 0; i < kept.length; i++) {
        drift += Math.abs(kept[i]! - fresh[i]!);
      }
      expect(
        drift / kept.length,
        'the climb atlas is stale: run npm run climb-atlas',
      ).toBeLessThanOrEqual(RENDER_DRIFT);
    });
  });

/* Build correctness: the hero draws atlas rects by number, so a re-exported atlas must still hold them. */
test.describe('the hero rabbit atlas', NODE, () => {
  test('every frame and its foot lie inside the atlas', async () => {
    const { width = 0, height = 0 } = await sharp(
      'src/assets/hero-rabbit.svg',
    ).metadata();
    expect({ width, height }, 'the atlas file and ATLAS_SIZE disagree').toEqual(
      { width: ATLAS_SIZE.w, height: ATLAS_SIZE.h },
    );
    for (const [pose, f] of Object.entries(RABBIT_FRAMES)) {
      expect(
        f.x + f.w <= width && f.y + f.h <= height,
        `the ${pose} frame runs past the ${width}x${height} atlas.`,
      ).toBe(true);
      expect(
        f.footX <= f.w && f.footY <= f.h,
        `the ${pose} foot lies outside its frame.`,
      ).toBe(true);
    }
  });
});
