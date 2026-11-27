/*
 * Pure. The hero hare's poses and drawing, from the atlas in rabbit-atlas.ts;
 * the poses face left and the route runs right, so it is drawn mirrored.
 */
import type { RoutePoint } from './hero-field-scene';

import { RABBIT_FRAMES, type RabbitPose } from './rabbit-atlas';

/** Atlas pixels per drawing unit; sets the rabbit's size, about 90 units tall sitting. */
const ATLAS_PX_PER_UNIT = 3.2;

/** Device px per atlas px the rabbit is drawn at, for `scale` CSS px per unit on a canvas of `pixelRatio`. */
export const atlasDensity = (scale: number, pixelRatio: number): number =>
  (scale / ATLAS_PX_PER_UNIT) * pixelRatio;

/* Share of a hop at each end spent crouched, taking off and landing. */
const CROUCH_SHARE = 0.14;
/* Below this the rabbit is settling into or out of a rest, so it crouches. */
const SETTLED = 0.5;
const RESTING = 0.05;
/* A rest alternates sitting and looking up, this long each. */
const GLANCE_SECONDS = 2.4;

export const rabbitPose = (here: RoutePoint, seconds: number): RabbitPose => {
  if (here.sit > RESTING) {
    if (here.sit < SETTLED) return 'crouch';
    return Math.floor(seconds / GLANCE_SECONDS) % 2 === 0 ? 'sit' : 'look';
  }
  return here.cycle < CROUCH_SHARE || here.cycle > 1 - CROUCH_SHARE
    ? 'crouch'
    : 'leap';
};

/** 0 on the ground, 1 at the top of the arc. */
export const rabbitAir = (here: RoutePoint): number =>
  here.sit > RESTING ? 0 : Math.sin(here.cycle * Math.PI);

/*
 * `lift` is the height above the ground in drawing units, `scale` CSS pixels
 * per unit. `atlas` holds the atlas at `density` times its own pixels: a copy
 * rasterised near the drawn size.
 */
export const drawRabbit = (
  ctx: CanvasRenderingContext2D,
  atlas: CanvasImageSource,
  x: number,
  ground: number,
  scale: number,
  pose: RabbitPose,
  lift: number,
  density = 1,
): void => {
  const frame = RABBIT_FRAMES[pose];
  const size = scale / ATLAS_PX_PER_UNIT;
  ctx.save();
  ctx.translate(x, ground - lift * scale);
  ctx.scale(-size, size);
  ctx.drawImage(
    atlas,
    frame.x * density,
    frame.y * density,
    frame.w * density,
    frame.h * density,
    -frame.footX,
    -frame.footY,
    frame.w,
    frame.h,
  );
  ctx.restore();
};
