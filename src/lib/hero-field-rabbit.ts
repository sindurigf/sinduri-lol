/*
 * Pure. The rabbit is four traced poses in one atlas (src/assets/hero-rabbit.webp),
 * die-cut sticker included; they face left and the route runs right, so it is
 * drawn mirrored. It moves as one piece and swaps poses; it never bends.
 */
import type { RoutePoint } from './hero-field-scene';

export type RabbitPose = 'sit' | 'look' | 'crouch' | 'leap';

/** Atlas pixels; the foot is the bottom centre of the rabbit within its frame. */
interface AtlasFrame {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  readonly footX: number;
  readonly footY: number;
}

/* Must match the atlas layout the frames were packed with. */
export const RABBIT_FRAMES: Readonly<Record<RabbitPose, AtlasFrame>> = {
  sit: { x: 0, y: 0, w: 239, h: 366, footX: 119, footY: 328 },
  look: { x: 243, y: 0, w: 244, h: 303, footX: 122, footY: 264 },
  crouch: { x: 491, y: 0, w: 266, h: 296, footX: 133, footY: 258 },
  leap: { x: 761, y: 0, w: 298, h: 287, footX: 149, footY: 248 },
};

/** Atlas pixels per drawing unit; sets the rabbit's size, about 90 units tall sitting. */
const ATLAS_PX_PER_UNIT = 3.2;

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

/* `hop` is the arc height in drawing units, `scale` CSS pixels per unit. */
export const drawRabbit = (
  ctx: CanvasRenderingContext2D,
  atlas: CanvasImageSource,
  x: number,
  ground: number,
  scale: number,
  pose: RabbitPose,
  lift: number,
): void => {
  const frame = RABBIT_FRAMES[pose];
  const size = scale / ATLAS_PX_PER_UNIT;
  ctx.save();
  ctx.translate(x, ground - lift * scale);
  ctx.scale(-size, size);
  ctx.drawImage(
    atlas,
    frame.x,
    frame.y,
    frame.w,
    frame.h,
    -frame.footX,
    -frame.footY,
    frame.w,
    frame.h,
  );
  ctx.restore();
};
