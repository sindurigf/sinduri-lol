import sharp from 'sharp';
import { expect, test } from './test';
import { readFileSync } from 'node:fs';
import { ATLAS_SIZE, RABBIT_FRAMES } from '../src/lib/rabbit-atlas';
import {
  CLIMB_ATLAS_TARGET,
  renderClimbAtlas,
} from '../src/lib/climb-atlas-render';
import { NODE } from './tags';

/* Mean difference per channel, out of 255, allowed between the raster and a fresh render of the SVG. */
const RENDER_DRIFT = 2;
const WEBP_LOSSLESS = 'VP8L';
const CHUNK_AT = 12;
const CHUNK_TAG = 4;

/* Performance and build correctness: Let It Fall's climb draws a lossless raster of the same atlas, which decodes off the main thread. */
test.describe('the climb atlas', NODE, () => {
  test('is lossless WebP at the atlas size', async () => {
    const file = readFileSync(CLIMB_ATLAS_TARGET);
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
    const fresh = await renderClimbAtlas().ensureAlpha().raw().toBuffer();
    const kept = await sharp(CLIMB_ATLAS_TARGET).ensureAlpha().raw().toBuffer();
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

/* Build correctness: home.css and the climb draw atlas rects by number; the atlas must hold them and home.css must name the same ones. */
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

  test('home.css draws each pose from the frame RABBIT_FRAMES gives it', () => {
    const css = readFileSync('src/styles/components/home.css', 'utf8');
    const read = (block: string, name: string) =>
      Number(new RegExp(`--${name}:\\s*(-?[\\d.]+);`).exec(block)?.[1]);
    for (const [pose, f] of Object.entries(RABBIT_FRAMES)) {
      const block =
        new RegExp(
          `\\.home-bun\\[data-pose='${pose}'\\] > i \\{([^}]*)\\}`,
        ).exec(css)?.[1] ?? '';
      expect(
        {
          x: read(block, 'x'),
          w: read(block, 'w'),
          h: read(block, 'h'),
          footX: read(block, 'fx'),
          footY: read(block, 'fy'),
        },
        `home.css draws the ${pose} pose from another frame than RABBIT_FRAMES.`,
      ).toEqual({ x: f.x, w: f.w, h: f.h, footX: f.footX, footY: f.footY });
    }
    expect(
      css,
      'home.css sizes the atlas to another width than ATLAS_SIZE.',
    ).toContain(`background-size: calc(${ATLAS_SIZE.w} * var(--k)) auto;`);
  });
});
