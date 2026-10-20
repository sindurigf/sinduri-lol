import sharp from 'sharp';
import { expect, test } from './test';
import { RABBIT_FRAMES, rabbitPose } from '../src/lib/hero-field-rabbit';
import { NODE } from './tags';

/* Build correctness: the hero draws atlas rects by number, so a re-exported atlas must still hold them. */
test.describe('the hero rabbit atlas', NODE, () => {
  test('every frame and its foot lie inside the atlas', async () => {
    const { width = 0, height = 0 } = await sharp(
      'src/assets/hero-rabbit.webp',
    ).metadata();
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

  test('a hop crouches at both ends and leaps in between; a settled rest sits or looks', () => {
    const hop = (cycle: number) =>
      rabbitPose({ x: 0, cycle, sit: 0, hop: 1 }, 0);
    expect(hop(0.02), 'take-off is not a crouch.').toBe('crouch');
    expect(hop(0.5), 'mid-hop is not a leap.').toBe('leap');
    expect(hop(0.98), 'landing is not a crouch.').toBe('crouch');
    expect(['sit', 'look'], 'a settled rest neither sits nor looks.').toContain(
      rabbitPose({ x: 0, cycle: 0, sit: 1, hop: 0 }, 0),
    );
  });
});
