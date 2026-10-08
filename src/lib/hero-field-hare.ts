/* Pure. Paths are in the bunny's own drawing units, independent of the box; y grows down, ground at 0. */
import { FOOT_Y } from './hero-field-scene';
import type { HeroPalette } from './hero-field-scene';

type Point = readonly [number, number];

const LINE = 2.1;

/* Body outline: eight cubic curves, closing back on the first point. */
const BODY: readonly Point[] = [
  [47, -17],
  [46, -28],
  [37, -35],
  [29, -33],
  [22, -31],
  [19, -22],
  [12, -22],
  [0, -24],
  [-16, -30],
  [-26, -24],
  [-34, -19],
  [-37, -6],
  [-34, 3],
  [-31, 10],
  [-24, 14],
  [-15, 15],
  [-3, 16],
  [9, 15],
  [18, 10],
  [25, 7],
  [29, 0],
  [31, -6],
  [38, -8],
  [47, -11],
];

/* Sitting tilts the body back about the bottom of the haunch, so the rump stays down. */
const PIVOT: Point = [-24, 14];
const SIT_TILT = -0.28;
const SIT_SETTLE = 6;
const HIP: Point = [-21, 10];
const SHOULDER: Point = [19, 8];
const FOOT = { length: 25, thickness: 6.4 } as const;
const PAW = { length: 10, thickness: 4.6 } as const;
const TAIL = {
  at: [-34, -17] as Point,
  ring: 3.4,
  petals: 5,
  petalScale: 1.35,
} as const;
const EYE: Point = [34, -25];
const EYE_RADIUS = 3.3;
const NOSE: Point = [46, -17];
const EAR_LENGTH = 1.12;
const EAR_LIFT = 0.3;

interface HopFrame {
  readonly cycle: number;
  /** 0 on the ground, 1 at the top of the arc. */
  readonly air: number;
  readonly pitch: number;
  readonly tuckFore: number;
  readonly squash: number;
  readonly earNear: number;
  readonly earFar: number;
  readonly sit: number;
}

/*
 * Signs that are easy to invert: pitch is negative cosine (nose up on the
 * rise), ears trail, and the front foot leads by 0.06 of a cycle.
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
    tuckFore: sitting
      ? 0
      : Math.pow(
          Math.max(0, Math.sin(Math.min(1, cycle + 0.06) * Math.PI)),
          0.8,
        ),
    squash: 1 - land * 0.14,
    earNear: -0.92 - velocity * 0.32 - twitch,
    earFar: -1.2 - velocity * 0.26 + twitch,
    sit,
  };
};

/* Hind foot per hop phase: heel offset from the hip, angle (0 is toes forward, flat), length share, and how planted it is. */
interface HindKey {
  readonly dx: number;
  readonly dy: number;
  readonly angle: number;
  readonly length: number;
  readonly planted: number;
}
/* The planted heel sits under the haunch, so the rump is one curve down to the foot. */
const PLANTED: HindKey = { dx: -1, dy: 0, angle: 0, length: 1, planted: 1 };
const HIND_KEYS: readonly (readonly [number, HindKey])[] = [
  [0, PLANTED],
  [0.14, { dx: -6, dy: 0, angle: 2.85, length: 0.8, planted: 0 }],
  [0.3, { dx: -3, dy: -1, angle: -0.1, length: 0.68, planted: 0 }],
  [0.5, { dx: -2, dy: -1, angle: -0.12, length: 0.72, planted: 0 }],
  [0.8, { dx: 25, dy: 0, angle: 0, length: 1, planted: 1 }],
  [1, PLANTED],
];

const smooth = (t: number): number => t * t * (3 - 2 * t);
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

const hindAt = (cycle: number): HindKey => {
  for (let i = 1; i < HIND_KEYS.length; i++) {
    const [t0, a] = HIND_KEYS[i - 1]!;
    const [t1, b] = HIND_KEYS[i]!;
    if (cycle <= t1) {
      const t = smooth((cycle - t0) / (t1 - t0));
      return {
        dx: lerp(a.dx, b.dx, t),
        dy: lerp(a.dy, b.dy, t),
        angle: lerp(a.angle, b.angle, t),
        length: lerp(a.length, b.length, t),
        planted: lerp(a.planted, b.planted, t),
      };
    }
  }
  return PLANTED;
};

const tiltOf = (frame: HopFrame): number => frame.pitch + frame.sit * SIT_TILT;

/* Body units to ground units: squash, then tilt about the pivot, then lift. */
const bodyToGround = (frame: HopFrame, lift: number): ((p: Point) => Point) => {
  const a = tiltOf(frame);
  const c = Math.cos(a);
  const s = Math.sin(a);
  return ([x, y]) => {
    const px = x - PIVOT[0];
    const py = (y - PIVOT[1]) * frame.squash;
    return [
      PIVOT[0] + px * c - py * s,
      PIVOT[1] - FOOT_Y - lift + px * s + py * c,
    ];
  };
};

const capsule = (
  ctx: CanvasRenderingContext2D,
  [x, y]: Point,
  angle: number,
  length: number,
  thickness: number,
): void => {
  const r = thickness / 2;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.beginPath();
  ctx.moveTo(0, -r);
  ctx.lineTo(length - r, -r);
  ctx.arc(length - r, 0, r, -Math.PI / 2, Math.PI / 2);
  ctx.lineTo(0, r);
  ctx.arc(0, 0, r, Math.PI / 2, -Math.PI / 2);
  ctx.closePath();
  ctx.restore();
};

const bar = (
  ctx: CanvasRenderingContext2D,
  from: Point,
  to: Point,
  thickness: number,
): void =>
  capsule(
    ctx,
    from,
    Math.atan2(to[1] - from[1], to[0] - from[0]),
    Math.hypot(to[0] - from[0], to[1] - from[1]) + thickness / 2,
    thickness,
  );

/* Closed Catmull-Rom spline as cubic Beziers: round corners, no straight runs. */
const closedSpline = (
  ctx: CanvasRenderingContext2D,
  points: readonly Point[],
): void => {
  const n = points.length;
  const at = (i: number): Point => points[(i + n) % n]!;
  ctx.beginPath();
  ctx.moveTo(...points[0]!);
  for (let i = 0; i < n; i++) {
    const [p0, p1, p2, p3] = [at(i - 1), at(i), at(i + 1), at(i + 2)];
    ctx.bezierCurveTo(
      p1[0] + (p2[0] - p0[0]) / 6,
      p1[1] + (p2[1] - p0[1]) / 6,
      p2[0] - (p3[0] - p1[0]) / 6,
      p2[1] - (p3[1] - p1[1]) / 6,
      p2[0],
      p2[1],
    );
  }
  ctx.closePath();
};

type Shape = (ctx: CanvasRenderingContext2D) => void;

/* Every closed shape of the silhouette in ground units; drawn twice (ink grown, then fill) for one clean outline. */
const silhouette = (
  frame: HopFrame,
  hop: number,
): { shapes: Shape[]; g: (p: Point) => Point } => {
  const sitting = frame.sit > 0.05;
  const g = bodyToGround(frame, frame.air * hop - frame.sit * SIT_SETTLE);
  const shapes: Shape[] = [];

  const body = BODY.map(g);
  shapes.push((ctx) => {
    ctx.beginPath();
    ctx.moveTo(...body[0]!);
    for (let i = 1; i < body.length; i += 3) {
      ctx.bezierCurveTo(
        ...body[i]!,
        ...body[i + 1]!,
        ...(body[i + 2] ?? body[0]!),
      );
    }
    ctx.closePath();
  });

  /* Hind leg: shin from hip to heel, then the long foot; the toes never dip below the ground. */
  const key = sitting ? PLANTED : hindAt(frame.cycle);
  const hip = g(HIP);
  const groundY = -FOOT.thickness / 2;
  const heel: Point = [
    hip[0] + key.dx,
    lerp(hip[1] + 8 + key.dy, groundY, key.planted),
  ];
  const length = FOOT.length * key.length;
  let angle = key.angle;
  if (heel[1] + Math.sin(angle) * length > groundY) {
    const lift = Math.min(1, Math.max(-1, (groundY - heel[1]) / length));
    angle = Math.cos(angle) < 0 ? Math.PI - Math.asin(lift) : Math.asin(lift);
  }
  const toe: Point = [
    heel[0] + Math.cos(angle) * length,
    heel[1] + Math.sin(angle) * length,
  ];
  if (!sitting) {
    shapes.push((ctx) => {
      ctx.beginPath();
      ctx.ellipse(hip[0] - 3, hip[1] - 1, 10, 8.5, 0, 0, Math.PI * 2);
    });
  }
  if (Math.hypot(heel[0] - hip[0], heel[1] - hip[1]) > 6) {
    shapes.push((ctx) => bar(ctx, hip, heel, FOOT.thickness));
  }
  shapes.push((ctx) => capsule(ctx, heel, angle, length, FOOT.thickness));

  /* Front paw: short and flat on the ground when down, folded under the chest in the air. */
  const shoulder = g(SHOULDER);
  const tuck = sitting ? 0 : frame.tuckFore;
  const paw: Point = [
    lerp(shoulder[0] + 1, shoulder[0] - 2, tuck),
    lerp(-PAW.thickness / 2, shoulder[1] + 6, tuck),
  ];
  shapes.push((ctx) => bar(ctx, shoulder, paw, 5.4));
  if (!sitting) {
    shapes.push((ctx) => {
      ctx.beginPath();
      ctx.ellipse(
        shoulder[0] - 3,
        shoulder[1] + 3,
        5.5,
        4.5,
        0,
        0,
        Math.PI * 2,
      );
    });
  }
  shapes.push((ctx) =>
    capsule(ctx, [paw[0] - 2, paw[1]], -0.5 * tuck, PAW.length, PAW.thickness),
  );

  /* Landing: a smooth web from the hip along the inside of the belly to the shoulder, then back along the feet, so no gap opens under the belly. */
  if (!sitting && frame.cycle > 0.55 && toe[0] > hip[0] + 4) {
    const half = FOOT.thickness / 2 + 1;
    const pawEdge: Point = [paw[0] + 3, paw[1]];
    const toeEdge: Point = [toe[0] - half, toe[1]];
    const front = toeEdge[0] > pawEdge[0] ? [toeEdge] : [pawEdge, toeEdge];
    const ring: Point[] = [
      hip,
      g([-6, 9]),
      g([6, 8]),
      [shoulder[0] - 2, shoulder[1] + 1],
      ...front,
      [heel[0] + half, heel[1]],
    ];
    shapes.push((ctx) => closedSpline(ctx, ring));
  }

  return { shapes, g };
};

/* Ears behind the head, each with its inner line. */
const drawEars = (
  ctx: CanvasRenderingContext2D,
  frame: HopFrame,
  g: (p: Point) => Point,
  palette: HeroPalette,
): void => {
  const tilt = tiltOf(frame);
  for (const [ex, ey, angle, width, length] of [
    [24, -27, frame.earFar, 5.2, 27],
    [26, -28, frame.earNear, 6, 31],
  ] as const) {
    const l = length * EAR_LENGTH;
    ctx.save();
    ctx.translate(...g([ex + 3, ey - 6]));
    ctx.rotate(angle + EAR_LIFT + tilt);
    ctx.scale(1, frame.squash);
    ctx.fillStyle = palette.background;
    ctx.strokeStyle = palette.border;
    ctx.lineWidth = LINE;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(-width, -l * 0.34, -width * 0.78, -l * 0.84, 0, -l);
    ctx.bezierCurveTo(width * 0.78, -l * 0.84, width, -l * 0.34, 0, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, -3);
    ctx.quadraticCurveTo(width * 0.3, -l * 0.55, 0, -l * 0.82);
    ctx.stroke();
    ctx.restore();
  }
};

/* Five-petal tail: a core and a ring of overlapping circles, inked as one shape so the edge is scalloped. */
const drawTail = (
  ctx: CanvasRenderingContext2D,
  frame: HopFrame,
  g: (p: Point) => Point,
  palette: HeroPalette,
): void => {
  const tilt = tiltOf(frame);
  const [cx, cy] = g(TAIL.at);
  const petal = TAIL.ring * Math.sin(Math.PI / TAIL.petals) * TAIL.petalScale;
  const circles: [number, number, number][] = [[cx, cy, TAIL.ring]];
  for (let i = 0; i < TAIL.petals; i++) {
    const a = tilt + (i / TAIL.petals) * Math.PI * 2;
    circles.push([
      cx + Math.cos(a) * TAIL.ring,
      cy + Math.sin(a) * TAIL.ring,
      petal,
    ]);
  }
  for (const [color, grow] of [
    [palette.border, LINE],
    [palette.background, 0],
  ] as const) {
    ctx.fillStyle = color;
    for (const [x, y, r] of circles) {
      ctx.beginPath();
      ctx.arc(x, y, r + grow, 0, Math.PI * 2);
      ctx.fill();
    }
  }
};

/*
 * `hop` is the arc height in drawing units. Every closed shape fills with the
 * hero ground, so stems behind never show through the body.
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
  const { shapes, g } = silhouette(frame, hop);
  ctx.save();
  ctx.translate(x, ground);
  ctx.scale(scale, scale);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  drawEars(ctx, frame, g, palette);

  ctx.fillStyle = palette.border;
  ctx.strokeStyle = palette.border;
  ctx.lineWidth = LINE * 2;
  for (const shape of shapes) {
    shape(ctx);
    ctx.fill();
    ctx.stroke();
  }
  ctx.fillStyle = palette.background;
  for (const shape of shapes) {
    shape(ctx);
    ctx.fill();
  }

  drawTail(ctx, frame, g, palette);

  const [ex, ey] = g(EYE);
  ctx.fillStyle = palette.border;
  ctx.beginPath();
  ctx.arc(ex, ey, EYE_RADIUS, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = palette.shine;
  ctx.beginPath();
  ctx.arc(
    ex + EYE_RADIUS * 0.35,
    ey - EYE_RADIUS * 0.38,
    EYE_RADIUS * 0.34,
    0,
    Math.PI * 2,
  );
  ctx.fill();
  const [nx, ny] = g(NOSE);
  ctx.fillStyle = palette.border;
  ctx.beginPath();
  ctx.arc(nx, ny, 1.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
};
