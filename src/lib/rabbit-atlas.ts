/*
 * Pure. The rabbit is four traced poses in one atlas (src/assets/hero-rabbit.svg,
 * rastered to hero-rabbit-climb.webp), die-cut sticker and ink-backed red
 * block included; they face left. It moves as one piece and swaps poses; it
 * never bends.
 */

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

/** The atlas's size in its own pixels, the frames' coordinates. */
export const ATLAS_SIZE = { w: 933, h: 335 } as const;

/** CSS px: the rabbit's height at most while it climbs onto Let It Fall's heap, the floor of --size-footer-rabbit; the two must agree. */
export const CLIMB_HEIGHT = 96;
