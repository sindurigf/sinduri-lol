/* Pure. Shapes are in the bunny's own drawing units, independent of the box; y grows down, ground at 0. */
import type { HeroPalette } from './hero-field-scene';

/* An ellipse [cx, cy, rx, ry] turned by rotations applied in order, each [degrees, about x, about y]. */
type Turn = readonly [deg: number, x: number, y: number];
interface Oval {
  readonly at: readonly [number, number, number, number];
  readonly turns: readonly Turn[];
}

/* Drawing units to the field's hare units, so the bunny keeps the size and shadow the scene was tuned for. */
const UNIT = 0.8;
const OFFSET_X = 10;
/* The field's existing line weight (2.1, grown both ways) in drawing units. */
const EDGE = (2 * 2.1) / UNIT;
const EAR_LINE = EDGE / 2;
const EYE_LINE = 3.4;

/* The approved build: two body ovals, a round head, ears, a puff tail, one hind foot and one paw. */
const BODY: readonly (readonly [number, number, number, number])[] = [
  [-14, -27.6, 38.4, 27.6],
  [-7.2, -26, 36.4, 25.6],
];
const HEAD = { x: 24.4, y: -61.6, r: 25.6 } as const;
const EAR = { length: 50, width: 15 } as const;
const TAIL = { x: -50.8, y: -32.4, r: 10 } as const;
const HIND = { x: -44.8, y: -4, rx: 15.6, ry: 5.5, deg: -3.6 } as const;
const PAW = { x: 26.4, y: -4.5, rx: 9, ry: 5 } as const;
const EYE = 7.5;
const PIVOT_X = BODY[0]![0] - BODY[0]![2] * 0.6;

/* Rest pose and the binky at the top of a hop; a hop blends between them by `air`. */
const REST = { tilt: -5, head: -7, ears: -4 } as const;
const BINKY = {
  tilt: -20,
  head: -14,
  ears: -38,
  kick: 34,
  secondKick: 52,
  paw: -30,
} as const;
const RAD = 180 / Math.PI;

interface HopFrame {
  readonly cycle: number;
  /** 0 on the ground, 1 at the top of the arc. */
  readonly air: number;
  readonly pitch: number;
  readonly squash: number;
  readonly earNear: number;
  readonly earFar: number;
  readonly sit: number;
}

/*
 * Signs that are easy to invert: pitch is negative cosine (nose up on the
 * rise) and the ears trail.
 */
export const hopFrame = (
  cycle: number,
  sit: number,
  seconds: number,
): HopFrame => {
  const velocity = Math.cos(cycle * Math.PI);
  const land = Math.max(0, 1 - Math.min(cycle, 1 - cycle) * 9);
  const sitting = sit > 0.05;

  let twitch =
    Math.sin(seconds * 2.3 + 1.7) > 0.86 ? Math.sin(seconds * 15) * 0.18 : 0;
  if (sit > 0.3) twitch += Math.sin(seconds * 2.7) * 0.22;

  return {
    cycle,
    air: sitting ? 0 : Math.sin(cycle * Math.PI),
    pitch: sitting ? 0 : -velocity * 0.28,
    squash: 1 - land * 0.14,
    earNear: -0.92 - velocity * 0.32 - twitch,
    earFar: -1.2 - velocity * 0.26 + twitch,
    sit,
  };
};

/* hopFrame's ear angles without the velocity sway: the binky blend already lays the ears back, so only the twitch is added. */
const EAR_NEAR_REST = -0.92;
const EAR_FAR_REST = -1.2;
const EAR_NEAR_SWAY = 0.32;
const EAR_FAR_SWAY = 0.26;

const oval = (
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  turns: readonly Turn[],
): Oval => ({ at: [cx, cy, rx, ry], turns });

const applyTurns = (
  ctx: CanvasRenderingContext2D,
  turns: readonly Turn[],
): void => {
  for (const [deg, x, y] of turns) {
    ctx.translate(x, y);
    ctx.rotate(deg / RAD);
    ctx.translate(-x, -y);
  }
};

const traceOval = (
  ctx: CanvasRenderingContext2D,
  { at, turns }: Oval,
): void => {
  ctx.save();
  applyTurns(ctx, turns);
  ctx.beginPath();
  ctx.ellipse(at[0], at[1], at[2], at[3], 0, 0, Math.PI * 2);
  ctx.restore();
};

/* Ink grown by half the edge, then the fill on top: one outline round every shape in the group. */
const paintGroup = (
  ctx: CanvasRenderingContext2D,
  shapes: readonly Oval[],
  ink: string,
  fill: string,
): void => {
  ctx.fillStyle = ink;
  ctx.strokeStyle = ink;
  ctx.lineWidth = EDGE;
  for (const shape of shapes) {
    traceOval(ctx, shape);
    ctx.fill();
    ctx.stroke();
  }
  ctx.fillStyle = fill;
  for (const shape of shapes) {
    traceOval(ctx, shape);
    ctx.fill();
  }
};

interface Pose {
  readonly lift: number;
  readonly tilt: number;
  readonly head: number;
  readonly earNear: number;
  readonly earFar: number;
  readonly air: number;
  readonly eyesOpen: boolean;
}

const poseOf = (frame: HopFrame, hop: number): Pose => {
  const a = frame.air;
  const blend = (rest: number, binky: number): number =>
    rest + (binky - rest) * a;
  const velocity = Math.cos(frame.cycle * Math.PI);
  const twitchNear = frame.earNear - EAR_NEAR_REST + velocity * EAR_NEAR_SWAY;
  const twitchFar = frame.earFar - EAR_FAR_REST + velocity * EAR_FAR_SWAY;
  return {
    lift: (a * hop) / UNIT,
    tilt: blend(REST.tilt, BINKY.tilt) + frame.pitch * RAD * 0.5,
    head: blend(REST.head, BINKY.head),
    earNear: blend(REST.ears, BINKY.ears) + twitchNear * RAD,
    earFar: blend(REST.ears, BINKY.ears) + twitchFar * RAD,
    air: a,
    eyesOpen: frame.sit > 0.3,
  };
};

const shapesOf = (p: Pose) => {
  const body: Turn = [p.tilt, PIVOT_X, 0];
  const head: Turn = [p.head, HEAD.x, HEAD.y];
  const fx = HEAD.x - 8;
  const fy = HEAD.y - HEAD.r * 0.75;
  const nx = HEAD.x + 4;
  const ny = HEAD.y - HEAD.r * 0.85;
  /* Feet stay planted at rest and join the body's tilt as the hop lifts them. */
  const footTilt: Turn = [p.tilt * p.air, PIVOT_X, 0];
  const nearEar: Turn = [14 + p.earNear, nx, ny];
  return {
    back: [
      ...(p.air > 0.02
        ? [
            oval(
              HIND.x - 8 * p.air,
              HIND.y - 6 * p.air,
              HIND.rx * 0.9,
              HIND.ry,
              [
                footTilt,
                [
                  HIND.deg + BINKY.secondKick * p.air,
                  HIND.x - 8 * p.air,
                  HIND.y - 6 * p.air,
                ],
              ],
            ),
          ]
        : []),
      oval(HIND.x, HIND.y, HIND.rx, HIND.ry, [
        footTilt,
        [HIND.deg + BINKY.kick * p.air, HIND.x, HIND.y],
      ]),
      oval(fx, fy - EAR.length * 0.47, EAR.width * 0.47, EAR.length * 0.47, [
        body,
        head,
        [-26 + p.earFar, fx, fy],
      ]),
    ],
    body: [
      ...BODY.map(([x, y, rx, ry]) => oval(x, y, rx, ry, [body])),
      oval(HEAD.x, HEAD.y, HEAD.r, HEAD.r, [body]),
    ],
    tail: [oval(TAIL.x, TAIL.y, TAIL.r, TAIL.r, [body])],
    front: [
      oval(nx, ny - EAR.length / 2, EAR.width / 2, EAR.length / 2, [
        body,
        head,
        nearEar,
      ]),
      oval(PAW.x, PAW.y, PAW.rx, PAW.ry, [
        footTilt,
        [BINKY.paw * p.air, PAW.x, PAW.y],
      ]),
    ],
    innerEar: oval(nx, ny - EAR.length / 2, EAR.width * 0.2, EAR.length * 0.3, [
      body,
      head,
      nearEar,
    ]),
    faceTurns: [body, head] as readonly Turn[],
  };
};

/* Four-point sparkle: quadratic curves pulled in to the center. */
const traceStar = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  s: number,
): void => {
  const k = s * 0.18;
  ctx.beginPath();
  ctx.moveTo(x, y - s);
  ctx.quadraticCurveTo(x + k, y - k, x + s, y);
  ctx.quadraticCurveTo(x + k, y + k, x, y + s);
  ctx.quadraticCurveTo(x - k, y + k, x - s, y);
  ctx.quadraticCurveTo(x - k, y - k, x, y - s);
  ctx.closePath();
};

const drawFace = (
  ctx: CanvasRenderingContext2D,
  turns: readonly Turn[],
  eyesOpen: boolean,
  palette: HeroPalette,
): void => {
  const ex = HEAD.x + HEAD.r * 0.42;
  const ey = HEAD.y - HEAD.r * 0.28;
  ctx.save();
  applyTurns(ctx, turns);
  if (eyesOpen) {
    ctx.fillStyle = palette.border;
    ctx.beginPath();
    ctx.ellipse(ex, ey - EYE * 0.15, EYE * 0.86, EYE * 1.12, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = palette.shine;
    ctx.beginPath();
    ctx.arc(ex + EYE * 0.28, ey - EYE * 0.6, EYE * 0.4, 0, Math.PI * 2);
    ctx.fill();
    traceStar(ctx, ex - EYE * 0.3, ey + EYE * 0.3, EYE * 0.34);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(ex + EYE * 0.4, ey + EYE * 0.42, EYE * 0.13, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.strokeStyle = palette.border;
    ctx.lineWidth = EYE_LINE;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(ex - EYE, ey + EYE * 0.3);
    ctx.quadraticCurveTo(ex, ey - EYE * 1.3, ex + EYE, ey + EYE * 0.3);
    ctx.stroke();
  }
  /* Tipped heart nose: a rounded triangle turned up at the front. */
  const nx = HEAD.x + HEAD.r - 2.5 - 1.2;
  const ny = HEAD.y + 3;
  ctx.translate(nx, ny);
  ctx.rotate(-30 / RAD);
  ctx.fillStyle = palette.border;
  ctx.beginPath();
  ctx.moveTo(-2.8, -1.4);
  ctx.quadraticCurveTo(0, -2.6, 2.8, -1.4);
  ctx.quadraticCurveTo(2.6, 1.6, 0, 2.2);
  ctx.quadraticCurveTo(-2.6, 1.6, -2.8, -1.4);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
};

/*
 * `hop` is the arc height in field units. The body fill is opaque, so stems
 * behind never show through.
 */
export const drawHare = (
  ctx: CanvasRenderingContext2D,
  x: number,
  ground: number,
  scale: number,
  frame: HopFrame,
  hop: number,
  palette: HeroPalette,
): void => {
  const pose = poseOf(frame, hop);
  const s = shapesOf(pose);
  ctx.save();
  ctx.translate(x, ground);
  /* A resting bunny keeps its full height; the landing squash is for hops only. */
  const squash = frame.sit > 0.05 ? 1 : frame.squash;
  ctx.scale(scale * UNIT, scale * UNIT * squash);
  ctx.translate(OFFSET_X, -pose.lift);
  ctx.lineJoin = 'round';

  paintGroup(ctx, s.back, palette.border, palette.background);
  paintGroup(ctx, s.body, palette.border, palette.background);
  for (const shape of [...s.tail, ...s.front]) {
    paintGroup(ctx, [shape], palette.border, palette.background);
  }
  /* Inner ear as a line down the near ear, like the field's other line work. */
  ctx.save();
  applyTurns(ctx, s.innerEar.turns);
  const [ix, iy, , iry] = s.innerEar.at;
  ctx.strokeStyle = palette.border;
  ctx.lineWidth = EAR_LINE;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(ix, iy + iry);
  ctx.quadraticCurveTo(ix + EAR.width * 0.12, iy, ix, iy - iry);
  ctx.stroke();
  ctx.restore();
  drawFace(ctx, s.faceTurns, pose.eyesOpen, palette);

  ctx.restore();
};
