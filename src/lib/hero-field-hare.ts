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
const PAW = { length: 7.5, thickness: 4.6 } as const;
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

/* Hind leg per hop phase: [cycle, hock dx, hock dy from the hip, foot angle (0 toes forward, PI toes back), foot length share]. */
const HIND_KEYS: readonly (readonly number[])[] = [
  [0, -1, 8, 0, 1],
  [0.1, -10, 11, Math.PI - 0.3, 1],
  [0.28, -18, -1, Math.PI + 0.35, 1],
  [0.48, -17, -1, Math.PI + 0.3, 0.95],
  [0.62, -6, 6, Math.PI - 0.75, 0.55],
  [0.74, 3, 8, 1.2, 0.6],
  [0.87, 10, 9, 0.25, 0.9],
  [0.95, 9, 8, 0, 1],
  [1, -1, 8, 0, 1],
];
/* Foreleg per hop phase: [cycle, paw dx, paw dy from the shoulder]. */
const FORE_KEYS: readonly (readonly number[])[] = [
  [0, 1, 20],
  [0.1, -4, 14],
  [0.32, 12, 10],
  [0.6, 11, 11],
  [0.82, 5, 18],
  [1, 1, 20],
];
const SHIN_REACH = 20;
const FORE_REACH = 19;
const FORE_THICKNESS = 4.2;
/* The far legs sit higher and behind, smaller, and a step later in the hop. */
const FAR = {
  scale: 0.85,
  hip: [-3, -5] as Point,
  shoulder: [-3, -3.5] as Point,
  hindLag: 0.03,
  foreLag: 0.04,
} as const;
const FOOT_GROUND = -FOOT.thickness / 2;
const PAW_GROUND = -PAW.thickness / 2;

const smooth = (t: number): number => t * t * (3 - 2 * t);
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

const sample = (
  keys: readonly (readonly number[])[],
  cycle: number,
): number[] => {
  for (let i = 1; i < keys.length; i++) {
    const a = keys[i - 1]!;
    const b = keys[i]!;
    if (cycle <= b[0]!) {
      const t = smooth((cycle - a[0]!) / (b[0]! - a[0]!));
      return a.slice(1).map((v, j) => lerp(v, b[j + 1]!, t));
    }
  }
  return keys[keys.length - 1]!.slice(1);
};

/* `to`, or the point `max` from `from` on the way to it. */
const reach = (from: Point, to: Point, max: number): Point => {
  const d = Math.hypot(to[0] - from[0], to[1] - from[1]);
  return d <= max
    ? to
    : [
        from[0] + ((to[0] - from[0]) * max) / d,
        from[1] + ((to[1] - from[1]) * max) / d,
      ];
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

/* Hind leg: thigh from the haunch to the hock, then the long foot; the toes never dip below the ground. */
const hindLeg = (
  hip: Point,
  cycle: number,
  sitting: boolean,
  scale: number,
  far: boolean,
): Shape[] => {
  const [dx, dy, footAngle, share] = sitting
    ? HIND_KEYS[0]!.slice(1)
    : sample(HIND_KEYS, cycle);
  const raised = reach(hip, [hip[0] + dx!, hip[1] + dy!], SHIN_REACH * scale);
  const hock: Point = [raised[0], Math.min(raised[1], FOOT_GROUND)];
  const length = FOOT.length * scale * share!;
  const thickness = FOOT.thickness * scale;
  let angle = footAngle!;
  if (hock[1] + Math.sin(angle) * length > FOOT_GROUND) {
    const lift = Math.min(1, Math.max(-1, (FOOT_GROUND - hock[1]) / length));
    angle = Math.cos(angle) < 0 ? Math.PI - Math.asin(lift) : Math.asin(lift);
  }
  const shapes: Shape[] = [];
  const span = Math.hypot(hock[0] - hip[0], hock[1] - hip[1]);
  if (!sitting && !far && span > 1) {
    const d: Point = [(hock[0] - hip[0]) / span, (hock[1] - hip[1]) / span];
    const n: Point = [-d[1], d[0]];
    const r = thickness / 2;
    const thigh: Point[] = [
      [hip[0] + n[0] * 8, hip[1] + n[1] * 8],
      [hip[0] - d[0] * 3, hip[1] - d[1] * 3],
      [hip[0] - n[0] * 8, hip[1] - n[1] * 8],
      [hock[0] - n[0] * r, hock[1] - n[1] * r],
      [hock[0] + d[0] * r * 0.6, hock[1] + d[1] * r * 0.6],
      [hock[0] + n[0] * r, hock[1] + n[1] * r],
    ];
    shapes.push((ctx) => closedSpline(ctx, thigh));
  } else if (span > 4) {
    shapes.push((ctx) => bar(ctx, hip, hock, thickness * 0.9));
  }
  shapes.push((ctx) => capsule(ctx, hock, angle, length, thickness));
  /* A flat foot meets the belly at a sharp angle; fill the wedge so the outline has no ink sliver. */
  if (!far && Math.cos(angle) > 0.9 && hock[1] >= FOOT_GROUND - 1) {
    const top = FOOT_GROUND - thickness / 2;
    const toe = hock[0] + length;
    const wedge: Point[] = [
      hip,
      [hock[0], top],
      [toe - 5, top],
      [toe - 10, top - 8],
    ];
    shapes.push((ctx) => closedSpline(ctx, wedge));
  }
  return shapes;
};

/* Foreleg: slim, with a small paw; it reaches the ground first when the shoulder is low enough. */
const foreLeg = (
  shoulder: Point,
  cycle: number,
  sitting: boolean,
  scale: number,
): Shape[] => {
  const [dx, dy] = sitting ? FORE_KEYS[0]!.slice(1) : sample(FORE_KEYS, cycle);
  const reached = reach(
    shoulder,
    [shoulder[0] + dx!, shoulder[1] + dy!],
    FORE_REACH * scale,
  );
  const paw: Point = [reached[0], Math.min(reached[1], PAW_GROUND)];
  const grounded = paw[1] >= PAW_GROUND - 0.5;
  const leg = Math.atan2(paw[1] - shoulder[1], paw[0] - shoulder[0]);
  return [
    (ctx) => bar(ctx, shoulder, paw, FORE_THICKNESS * scale),
    (ctx) =>
      capsule(
        ctx,
        [paw[0] - 1.5, paw[1]],
        grounded ? 0 : leg - 1.1,
        PAW.length * scale,
        PAW.thickness * scale,
      ),
  ];
};

/* Every closed shape in ground units; each group is drawn twice (ink grown, then fill) for one clean outline. */
const silhouette = (
  frame: HopFrame,
  hop: number,
): { near: Shape[]; far: Shape[]; g: (p: Point) => Point } => {
  const sitting = frame.sit > 0.05;
  const g = bodyToGround(frame, frame.air * hop - frame.sit * SIT_SETTLE);
  const body = BODY.map(g);
  const hip = g(HIP);
  const shoulder = g(SHOULDER);
  const near: Shape[] = [
    (ctx) => {
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
    },
    ...hindLeg(hip, frame.cycle, sitting, 1, false),
    ...foreLeg(shoulder, frame.cycle, sitting, 1),
  ];
  const far: Shape[] = sitting
    ? []
    : [
        ...hindLeg(
          [hip[0] + FAR.hip[0], hip[1] + FAR.hip[1]],
          Math.max(0, frame.cycle - FAR.hindLag),
          false,
          FAR.scale,
          true,
        ),
        ...foreLeg(
          [shoulder[0] + FAR.shoulder[0], shoulder[1] + FAR.shoulder[1]],
          Math.max(0, frame.cycle - FAR.foreLag),
          false,
          FAR.scale,
        ),
      ];
  return { near, far, g };
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
  const { near, far, g } = silhouette(frame, hop);
  ctx.save();
  ctx.translate(x, ground);
  ctx.scale(scale, scale);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  drawEars(ctx, frame, g, palette);

  for (const group of [far, near]) {
    ctx.fillStyle = palette.border;
    ctx.strokeStyle = palette.border;
    ctx.lineWidth = LINE * 2;
    for (const shape of group) {
      shape(ctx);
      ctx.fill();
      ctx.stroke();
    }
    ctx.fillStyle = palette.background;
    for (const shape of group) {
      shape(ctx);
      ctx.fill();
    }
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
