/*
 * Pure. The rabbit is four traced poses in one vector atlas (src/assets/hero-rabbit.svg),
 * die-cut sticker and ink-backed pink block included; they face left and the
 * route runs right, so it is drawn mirrored. It moves as one piece and swaps
 * poses; it never bends.
 */
import type { RoutePoint } from './hero-field-scene';

export type RabbitPose = 'sit' | 'look' | 'crouch' | 'leap';

/** Atlas pixels; the foot is the bottom center of the rabbit within its frame. */
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
  sit: { x: 0, y: 0, w: 207, h: 335, footX: 103, footY: 312 },
  look: { x: 211, y: 0, w: 213, h: 271, footX: 106, footY: 249 },
  crouch: { x: 428, y: 0, w: 234, h: 265, footX: 117, footY: 242 },
  leap: { x: 666, y: 0, w: 267, h: 255, footX: 133, footY: 233 },
};

/** Atlas pixels per drawing unit; sets the rabbit's size, about 90 units tall sitting. */
const ATLAS_PX_PER_UNIT = 3.2;

/** The atlas's size in its own pixels, the frames' coordinates. */
export const ATLAS_SIZE = { w: 933, h: 335 } as const;

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
