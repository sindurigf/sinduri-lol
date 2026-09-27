/*
 * Poses and moves for the About cats. A move is a timeline of poses plus
 * modifiers; x runs forward in the direction the cat faces when it starts, and
 * `face: -1` means turned round. about-cats.ts places moves on a track.
 */
import type {
  CatId,
  Pair,
  Pose,
  PropKind,
  PropState,
} from './about-cats-types';

export type { Pose };

const BASE: Pose = {
  x: 0,
  y: 0,
  face: 1,
  ba: 0,
  by: 26,
  bt: 20,
  sq: 1,
  haunch: 0,
  fN: [12, 26],
  fF: [8, 26],
  hN: [-12, 26],
  hF: [-8, 26],
  /* Standing, the hip and shoulder sit 23px up: legs of 19px would leave the paws short. */
  fl: 1.22,
  hl: 1.22,
  hx: 6,
  hy: -12,
  hr: 0,
  ta: 235,
  tc: 8,
  tw: 0,
  eyes: 1,
  ears: 0,
  rot: 0,
  mouth: 0,
  zz: 0,
};

export const clonePose = (p: Pose): Pose => ({
  ...p,
  fN: [...p.fN],
  fF: [...p.fF],
  hN: [...p.hN],
  hF: [...p.hF],
});

const derive = (from: Pose, over: Partial<Pose>): Pose => ({
  ...clonePose(from),
  ...over,
});

const SIT = derive(BASE, {
  ba: 62,
  by: 25,
  haunch: 13,
  fN: [9, 25],
  fF: [6, 25],
  hN: [-1, 25],
  hF: [1, 25],
  fl: 1.82,
  hx: 4,
  hy: -13,
  ta: 165,
  tc: -22,
});
const LOAF = derive(BASE, {
  by: 11,
  bt: 21,
  haunch: 5,
  fN: [12, 11],
  fF: [9, 11],
  hN: [-9, 11],
  hF: [-6, 11],
  hx: 8,
  hy: -8,
  ta: 175,
  tc: -16,
});

const POSES = {
  stand: BASE,
  sit: SIT,
  loaf: LOAF,
  /* Curled up: back rounded, chin down on the paws, tail wrapped to the chest. */
  sleep: derive(LOAF, {
    ba: -4,
    by: 11,
    bt: 24,
    sq: 0.86,
    fN: [12, 11],
    fF: [9, 11],
    hN: [-9, 11],
    hF: [-6, 11],
    hx: 13,
    hy: -4.5,
    hr: 30,
    eyes: 0,
    ears: 1,
    ta: 122,
    tc: -13,
    zz: 1,
  }),
  rear: derive(BASE, {
    ba: 72,
    by: 27,
    haunch: 10,
    fN: [11, -4],
    fF: [8, 0],
    hN: [0, 27],
    hF: [2, 27],
    hx: 3,
    hy: -13,
    hr: -15,
    ta: 160,
    tc: -18,
  }),
  stretch: derive(BASE, {
    ba: -20,
    by: 21,
    fN: [27, 21],
    fF: [23, 21],
    hN: [-11, 21],
    hF: [-8, 21],
    hx: 13,
    hy: 3,
    hr: -8,
    eyes: 0,
    ta: 250,
    tc: 6,
  }),
  /* The head turns with the roll, so `hr: 180` keeps the face upright on the back. */
  belly: derive(BASE, {
    rot: 180,
    by: 12,
    /* Paws well clear of the belly, so they read as up in the air. */
    fN: [12, 24],
    fF: [6, 26],
    hN: [-12, 24],
    hF: [-6, 26],
    hx: 8,
    hy: 3,
    hr: 180,
    ta: 185,
    tc: 0,
  }),
  knead: derive(BASE, {
    ba: 8,
    by: 16,
    fN: [14, 16],
    fF: [11, 16],
    hN: [-9, 16],
    hF: [-6, 16],
    hx: 8,
    hy: -10,
    eyes: 0,
    ta: 175,
    tc: -12,
  }),
  crouch: derive(BASE, {
    ba: -5,
    by: 16,
    bt: 19,
    fN: [16, 16],
    fF: [13, 16],
    hN: [-9, 16],
    hF: [-6, 16],
    hx: 10,
    hy: -5,
    ta: 190,
    tc: 2,
    ears: 0.3,
  }),
  air: derive(BASE, {
    ba: 10,
    by: 30,
    sq: 1.08,
    fN: [22, 6],
    fF: [19, 9],
    hN: [-22, 10],
    hF: [-19, 12],
    hx: 9,
    hy: -9,
    /* Tail streams out behind in a leap, not up: that is the band's headroom. */
    ta: 182,
    tc: 1,
  }),
  reach: derive(BASE, {
    ba: -8,
    by: 22,
    sq: 1.05,
    fN: [20, 20],
    fF: [16, 22],
    hN: [-18, 4],
    hF: [-15, 6],
    hx: 9,
    hy: -8,
    ta: 186,
    tc: 2,
  }),
  /* Straight up after a fly: body upright, front paws high, tail streaming. */
  leap: derive(BASE, {
    ba: 62,
    by: 24,
    haunch: 6,
    fN: [15, -14],
    fF: [13, -11],
    hN: [0, 24],
    hF: [2, 26],
    hx: 4,
    hy: -14,
    hr: -24,
    ta: 150,
    tc: -6,
  }),
} satisfies Record<string, Pose>;

type PoseName = keyof typeof POSES;

export const pose = (name: PoseName, over: Partial<Pose> = {}): Pose =>
  derive(POSES[name], over);

const lerp = (a: number, b: number, k: number): number => a + (b - a) * k;

/** A paw moving along the ground between two poses lifts this much per px it travels, so it steps rather than slides. */
const SHIFT_LIFT = 0.5;
const SHIFT_LIFT_MAX = 4;
const onGround = (p: Pose, paw: Pair): boolean =>
  p.rot === 0 && Math.abs(paw[1] - p.by) < 0.5;
const pairDown = (a: Pose, b: Pose, front: boolean): boolean =>
  (front ? (['fN', 'fF'] as const) : (['hN', 'hF'] as const)).every(
    (k) => onGround(a, a[k]) && onGround(b, b[k]),
  );

export const mixPose = (a: Pose, b: Pose, k: number): Pose => {
  const out = clonePose(b);
  const frontDown = pairDown(a, b, true);
  const hindDown = pairDown(a, b, false);
  for (const key of Object.keys(b) as (keyof Pose)[]) {
    const va = a[key];
    const vb = b[key];
    if (Array.isArray(va) && Array.isArray(vb)) {
      (out[key] as Pair) = [lerp(va[0], vb[0], k), lerp(va[1], vb[1], k)];
      const otherDown = key[0] === 'f' ? hindDown : frontDown;
      if (onGround(a, va) && onGround(b, vb) && otherDown) {
        /* Front paws step in the first half, hind paws in the second: two stay down. */
        const half = Math.min(
          1,
          Math.max(0, key[0] === 'f' ? 2 * k : 2 * k - 1),
        );
        (out[key] as Pair)[0] = lerp(va[0], vb[0], half);
        (out[key] as Pair)[1] -=
          Math.sin(Math.PI * half) *
          Math.min(SHIFT_LIFT_MAX, SHIFT_LIFT * Math.abs(vb[0] - va[0]));
      }
    } else if (typeof va === 'number' && typeof vb === 'number') {
      (out[key] as number) = lerp(va, vb, k);
    }
  }
  return out;
};

const EASE = {
  linear: (k: number) => k,
  inOut: (k: number) => (k < 0.5 ? 4 * k ** 3 : 1 - (-2 * k + 2) ** 3 / 2),
  out: (k: number) => 1 - (1 - k) ** 3,
  in: (k: number) => k ** 3,
  back: (k: number) => 1 + 2.4 * (k - 1) ** 3 + 1.4 * (k - 1) ** 2,
  /* All at once halfway: a flat sticker cannot turn, so it flips mid-hop. */
  snap: (k: number) => (k < 0.5 ? 0 : 1),
} as const;

type Ease = keyof typeof EASE;

interface Step {
  ms: number;
  pose: Pose;
  ease: Ease;
}

interface Mod {
  from: number;
  to: number;
  apply: (p: Pose, elapsed: number, progress: number) => void;
}

export interface Move {
  steps: Step[];
  mods: Mod[];
  prop?: PropKind;
  /** Prop position relative to the cat's starting point, forward positive. */
  propAt?: (t: number) => PropState;
  /** Plays at a track end, facing out, so the cup goes over the edge; see withApproach. */
  edge?: boolean;
}

const step = (
  ms: number,
  name: PoseName,
  over: Partial<Pose> = {},
  ease: Ease = 'inOut',
): Step => ({ ms, pose: pose(name, over), ease });

const between = (from: number, to: number, apply: Mod['apply']): Mod => ({
  from,
  to,
  apply,
});

/** Travel in px per full stride; a paw on the ground moves back exactly as fast as the body goes forward. */
const STRIDE = 26;
const STEP_LIFT = 4;
/** ms over which a walk's steps start and stop, so the paws never jump to place. */
const GAIT_BLEND_MS = 180;

const gait = (
  p: Pose,
  distance: number,
  strength: number,
  weight: number,
): void => {
  const stride = STRIDE * strength;
  const reach = stride / 4;
  const cycle = distance / stride;
  const legs: [keyof Pick<Pose, 'fN' | 'fF' | 'hN' | 'hF'>, number][] = [
    ['fN', 0],
    ['hF', 0.25],
    ['fF', 0.5],
    ['hN', 0.75],
  ];
  for (const [leg, offset] of legs) {
    const u = (((cycle + offset) % 1) + 1) % 1;
    if (u < 0.5) {
      p[leg][0] += weight * reach * (1 - 4 * u);
    } else {
      const k = (u - 0.5) * 2;
      const e = k * k * (3 - 2 * k);
      p[leg][0] += weight * reach * (-1 + 2 * e);
      p[leg][1] -= weight * Math.sin(Math.PI * k) * STEP_LIFT * strength;
    }
  }
  p.hy += weight * Math.sin(cycle * 4 * Math.PI) * 0.4;
};

const walking = (from: number, to: number, strength = 1): Mod =>
  between(from, to, (p, s) =>
    gait(
      p,
      p.x * Math.sign(p.face),
      strength,
      Math.min(1, s / GAIT_BLEND_MS, (to - from - s) / GAIT_BLEND_MS),
    ),
  );
/** Hind paws tread in turn, lifting, while the rump sways over them. */
const TREAD_LIFT = 2;
const wiggle = (from: number, to: number): Mod =>
  between(from, to, (p, s) => {
    const w = Math.sin(s / 45);
    p.x += 0.6 * w;
    for (const k of ['fN', 'fF', 'hN', 'hF'] as const) p[k][0] -= 0.6 * w;
    p.hN[1] -= TREAD_LIFT * Math.max(0, w);
    p.hF[1] -= TREAD_LIFT * Math.max(0, -w);
    p.tw = 6;
  });
const blinkAt = (at: number): Mod =>
  between(at, at + 160, (p) => {
    p.eyes = 0;
  });
/** A jump's rise and fall; it ends with its landing step, so the paws touch down as the arc does. */
const arc = (from: number, to: number, height: number): Mod =>
  between(from, to, (p, _s, k) => {
    p.y += Math.sin(Math.PI * k) * height;
  });
/* Three slow breaths, ending on an exhale so the pose rests where it started. */
const BREATH_MS = 1000;
const BREATHS = 3;
/** Body thickness in px the chest gains at the top of a breath. */
const BREATH_DEPTH = 1.4;
const breathing = (from: number): Mod =>
  between(from, from + BREATH_MS * BREATHS, (p, s) => {
    p.bt += BREATH_DEPTH * Math.sin((2 * Math.PI * s) / BREATH_MS);
  });
/** The "z" rises once per breath, then rests above the head, not back at the start. */
const dozing = (from: number): Mod =>
  between(from, from + BREATH_MS * BREATHS, (p, s) => {
    p.zz = s >= BREATH_MS * BREATHS ? 1 : (s % BREATH_MS) / BREATH_MS;
  });
const earFlick = (at: number): Mod =>
  between(at, at + 280, (p, _s, k) => {
    p.ears = Math.max(p.ears, Math.sin(Math.PI * k) * 0.6);
  });

/* Arcs in px; with them the tallest move stays under --spacing-cat-band (tests/about-cats.spec.ts). */
const JUMP_HEIGHT = 39;
const POUNCE_HEIGHT = 34;
const LEAP_HEIGHT = 27;
const HOP_HEIGHT = 30;
/** The scratching post stands this far ahead of the cat, clear of its chest. */
const POST_GAP = 34;
const YARN_BOUND_HEIGHT = 22;
const FLY_HOP_HEIGHT = 24;
/* The fly's route, [ms, x, y] ahead of the cat: it lands, is missed, circles, and escapes. */
const FLY_PATH: readonly (readonly [number, number, number])[] = [
  [0, 40, -60],
  [1800, 75, -58],
  [2500, 130, -4],
  [4600, 130, -4],
  [5100, 140, -70],
  [6700, 140, -66],
  [7700, 175, -55],
  [8500, 220, -60],
  [9300, 290, -95],
];
const FLY_LANDS = 2500;
const FLY_TAKES_OFF = 4600;
const FLY_ESCAPES = 8600;
/** Knead rhythm (ms per radian) and how high each paw lifts, in px. */
const KNEAD_BEAT = 260;
const KNEAD_LIFT = 7;
/** The blanket lies under the front paws and ahead, so most of it shows. */
const BLANKET_AHEAD = 38;

/** A point along a timed route, straight between its points. */
const along = (
  route: readonly (readonly [number, number, number])[],
  t: number,
): [number, number] => {
  for (let i = 1; i < route.length; i += 1) {
    const [t1, x1, y1] = route[i];
    const [t0, x0, y0] = route[i - 1];
    if (t <= t1) {
      const k = (t - t0) / (t1 - t0 || 1);
      return [x0 + (x1 - x0) * k, y0 + (y1 - y0) * k];
    }
  }
  const [, x, y] = route[route.length - 1];
  return [x, y];
};

/*
 * Rolling onto the back: low, then over all at once with a small flop. Easing
 * the 180° roll would stand the cat on its head halfway.
 */
const FLOP_HOP = 4;
/** Body height before the roll; upright poses keep their paws on the ground there. */
const FLOP_LOW = 9;
const groundedAt = (name: PoseName, by: number): Partial<Pose> =>
  POSES[name].rot !== 0
    ? {}
    : Object.fromEntries(
        (['fN', 'fF', 'hN', 'hF'] as const).map((k) => [
          k,
          [POSES[name][k][0], by],
        ]),
      );
const flopTo = (
  from: PoseName,
  to: PoseName,
  x = 0,
  over: Partial<Pose> = {},
): Step[] => [
  step(
    200,
    from,
    { x, by: FLOP_LOW, sq: 0.92, ...groundedAt(from, FLOP_LOW), ...over },
    'in',
  ),
  step(200, to, { x, sq: 0.92 }, 'snap'),
  step(300, to, { x }, 'out'),
];
const flopOver = flopTo('loaf', 'belly');
const flopBack = flopTo('belly', 'loaf');

const still = (kind: PropKind, x: number, y = 0): PropState => ({
  kind,
  x,
  y,
  r: 0,
  o: 1,
});

export const MOVES = {
  look: (): Move => ({
    steps: [
      step(900, 'sit', { hr: -10 }),
      step(1100, 'sit', { hr: 9 }),
      step(800, 'sit'),
    ],
    mods: [blinkAt(600), earFlick(1500), blinkAt(2500)],
  }),
  lie: (): Move => ({
    steps: [step(700, 'loaf'), step(2200, 'loaf', { hr: 4 }), step(600, 'sit')],
    mods: [blinkAt(1600)],
  }),
  /* A long crouched creep with a freeze halfway, then the pounce. */
  stalk: (): Move => ({
    steps: [
      step(400, 'crouch'),
      step(2200, 'crouch', { x: 90 }, 'linear'),
      step(800, 'crouch', { x: 90 }),
      step(1400, 'crouch', { x: 160 }, 'linear'),
      step(700, 'crouch', { x: 160 }),
      step(140, 'crouch', { x: 158, sq: 0.9 }, 'in'),
      step(400, 'air', { x: 210 }, 'linear'),
      step(150, 'crouch', { x: 216, sq: 0.84 }, 'out'),
      step(280, 'crouch', { x: 216 }, 'back'),
      step(500, 'sit', { x: 216 }),
    ],
    mods: [
      walking(400, 2600, 0.6),
      walking(3400, 4800, 0.6),
      between(400, 5500, (p) => {
        p.tw = 4;
      }),
      wiggle(4800, 5500),
      arc(5640, 6190, POUNCE_HEIGHT),
    ],
  }),
  pounce: (): Move => ({
    steps: [
      step(400, 'crouch'),
      step(900, 'crouch'),
      step(140, 'crouch', { x: -2, sq: 0.9 }, 'in'),
      step(400, 'air', { x: 55 }, 'linear'),
      step(150, 'crouch', { x: 62, sq: 0.84 }, 'out'),
      step(280, 'crouch', { x: 62 }, 'back'),
      step(600, 'sit', { x: 62 }),
    ],
    mods: [wiggle(400, 1300), arc(1440, 1990, POUNCE_HEIGHT)],
  }),
  bigJump: (): Move => ({
    steps: [
      step(400, 'crouch'),
      step(1200, 'crouch'),
      step(160, 'crouch', { x: -2, sq: 0.88 }, 'in'),
      step(320, 'air', { x: 70, ba: 18 }, 'linear'),
      step(320, 'reach', { x: 140 }, 'linear'),
      step(160, 'crouch', { x: 148, sq: 0.8 }, 'out'),
      step(320, 'crouch', { x: 148 }, 'back'),
      step(700, 'sit', { x: 148 }),
    ],
    mods: [wiggle(400, 1600), arc(1760, 2400, JUMP_HEIGHT)],
  }),
  stretch: (): Move => ({
    steps: [
      step(500, 'stand'),
      step(700, 'stretch'),
      step(900, 'stretch'),
      step(500, 'stand'),
      step(500, 'sit', { hr: -25, eyes: 0, mouth: 1, ears: 0.3 }),
      step(700, 'sit', { hr: -25, eyes: 0, mouth: 1, ears: 0.3 }),
      step(400, 'sit'),
    ],
    mods: [],
  }),
  /* Kneads the blanket: paws pressing in turn, head bobbing, eyes shut, tail sweeping slowly. */
  knead: (): Move => {
    const settle = step(500, 'knead');
    const kneading = step(4200, 'knead');
    const steps = [settle, kneading, step(500, 'loaf'), step(500, 'sit')];
    const end = stepsDuration(steps);
    return {
      steps,
      prop: 'blanket',
      propAt: (t) => ({
        ...still('blanket', BLANKET_AHEAD),
        o: Math.min(1, t / 300, Math.max(0, (end - t) / 300)),
      }),
      mods: [
        between(settle.ms, settle.ms + kneading.ms, (p, s) => {
          const w = Math.sin(s / KNEAD_BEAT);
          p.fN[1] -= KNEAD_LIFT * Math.max(0, w);
          p.fF[1] -= KNEAD_LIFT * Math.max(0, -w);
          p.fN[0] += 2 * Math.max(0, w);
          p.fF[0] += 2 * Math.max(0, -w);
          p.hy += 1.2 * w;
          p.ba += 1.5 * w;
          p.tw = 3;
        }),
      ],
    };
  },
  /* Bats at the feather toy on its string: swats, a rear, a double swipe, and a last swat. */
  toy: (): Move => {
    const hit = (t: number, at: number): number =>
      t > at ? 30 * Math.exp(-(t - at) / 600) * Math.sin((t - at) / 120) : 0;
    const steps = [
      step(700, 'sit', { hr: -15 }),
      step(160, 'sit', { hr: -18, fN: [20, -18] }, 'out'),
      step(500, 'sit', { hr: -15 }),
      step(160, 'sit', { hr: -20, fN: [20, -20] }, 'out'),
      step(600, 'sit', { hr: -12 }),
      step(400, 'rear'),
      step(160, 'rear', { fN: [18, -22], fF: [16, -18] }, 'out'),
      step(260, 'rear'),
      step(160, 'rear', { fN: [18, -22], fF: [16, -18] }, 'out'),
      step(500, 'sit', { hr: -15 }),
      step(160, 'sit', { hr: -18, fN: [20, -18] }, 'out'),
      step(500, 'sit'),
      step(600, 'sit'),
    ];
    const end = stepsDuration(steps);
    return {
      steps,
      mods: [],
      prop: 'toy',
      propAt: (t) => ({
        kind: 'toy',
        x: 28,
        y: -32 + 4 * Math.sin(t / 700),
        r:
          hit(t, 860) +
          hit(t, 1520) +
          hit(t, 2780) +
          hit(t, 3200) +
          hit(t, 3860),
        o: Math.min(1, t / 300, Math.max(0, (end - t) / 400)),
      }),
    };
  },
  knock: (): Move => ({
    steps: [
      step(600, 'sit', { hr: 12 }),
      step(300, 'sit', { fN: [21, 14] }, 'out'),
      step(300, 'sit'),
      step(900, 'sit', { hr: -8 }),
      step(250, 'sit', { fN: [24, 13] }, 'out'),
      step(900, 'sit', { hr: 25 }),
      step(400, 'sit'),
    ],
    mods: [],
    prop: 'cup',
    edge: true,
    propAt: (t) => {
      let x = 23;
      let y = 0;
      let r = 0;
      if (t > 750) x = 27;
      if (t > 2250) {
        const k = Math.min(1, (t - 2250) / 700);
        x = 27 + 22 * Math.min(1, k * 3);
        y = k > 0.33 ? ((k - 0.33) * 3) ** 2 * 40 : 0;
        r = k * 140;
      }
      return { kind: 'cup', x, y, r, o: Math.min(1, t / 300, y > 30 ? 0 : 1) };
    },
  }),
  belly: (): Move => ({
    steps: [
      step(500, 'loaf'),
      ...flopOver,
      step(1600, 'belly'),
      ...flopBack,
      step(400, 'loaf'),
      step(500, 'sit'),
    ],
    mods: [
      arc(700, 900, FLOP_HOP),
      arc(3000, 3200, FLOP_HOP),
      between(1200, 2800, (p, s) => {
        p.fN[0] += 4 * Math.sin(s / 90);
        p.fF[0] -= 4 * Math.sin(s / 90 + 1);
        p.hN[0] += 5 * Math.sin(s / 70);
        p.hF[0] -= 5 * Math.sin(s / 70);
      }),
    ],
  }),
  /*
   * The fly lands; the cat stalks it and pounces, misses, swats at it overhead,
   * follows it along the band in hops, leaps for it, and it gets away.
   */
  fly: (): Move => ({
    steps: [
      step(1200, 'sit'),
      step(300, 'crouch'),
      step(120, 'crouch', { sq: 0.88 }, 'in'),
      step(350, 'air', { x: 50 }, 'linear'),
      step(150, 'crouch', { x: 60, sq: 0.86 }, 'out'),
      step(700, 'crouch', { x: 60, hr: 6 }),
      step(1000, 'crouch', { x: 72 }, 'linear'),
      step(600, 'crouch', { x: 72 }),
      step(140, 'crouch', { x: 72, sq: 0.9 }, 'in'),
      step(350, 'air', { x: 100 }, 'linear'),
      step(150, 'crouch', { x: 108, sq: 0.84 }, 'out'),
      step(600, 'sit', { x: 108, hr: -22 }),
      step(400, 'rear', { x: 108 }),
      step(160, 'rear', { x: 108, fN: [18, -22], fF: [16, -18] }, 'out'),
      step(260, 'rear', { x: 108 }),
      step(160, 'rear', { x: 108, fN: [18, -22], fF: [16, -18] }, 'out'),
      step(300, 'crouch', { x: 108 }),
      step(120, 'crouch', { x: 108, sq: 0.88 }, 'in'),
      step(350, 'air', { x: 150 }, 'linear'),
      step(150, 'crouch', { x: 160, sq: 0.86 }, 'out'),
      step(350, 'crouch', { x: 160, hr: -18 }),
      step(160, 'crouch', { x: 160, sq: 0.86 }, 'in'),
      step(260, 'leap', { x: 190 }, 'out'),
      step(260, 'leap', { x: 200 }, 'in'),
      step(150, 'crouch', { x: 210, sq: 0.84 }, 'out'),
      step(500, 'sit', { x: 210, hr: -20 }),
      step(600, 'sit', { x: 210 }),
    ],
    mods: [
      between(0, 1200, (p, s) => {
        p.hr = -18 + 14 * Math.sin(s / 260);
      }),
      wiggle(1200, 1500),
      arc(1620, 2120, FLY_HOP_HEIGHT),
      walking(2820, 3820, 0.6),
      between(2820, 4420, (p) => {
        p.tw = 5;
      }),
      wiggle(3820, 4420),
      arc(4560, 5060, POUNCE_HEIGHT),
      wiggle(6640, 6940),
      arc(7060, 7560, FLY_HOP_HEIGHT),
      wiggle(7560, 7910),
      arc(8070, 8740, LEAP_HEIGHT),
    ],
    prop: 'fly',
    propAt: (t) => {
      const [x, y] = along(FLY_PATH, t);
      const buzz = t < FLY_LANDS || t > FLY_TAKES_OFF ? 1 : 0;
      const away = Math.min(1, Math.max(0, (t - FLY_ESCAPES) / 700));
      return {
        kind: 'fly',
        x: x + buzz * 10 * Math.sin(t / 260),
        y: y + buzz * 8 * Math.sin(t / 170),
        r: 0,
        o: 1 - away,
      };
    },
  }),
  /* A springy hop on the spot, at nothing in particular. */
  hop: (): Move => ({
    steps: [
      step(300, 'crouch'),
      step(140, 'crouch', { sq: 0.88 }, 'in'),
      step(220, 'air', { x: 8 }, 'out'),
      step(220, 'air', { x: 14 }, 'in'),
      step(140, 'crouch', { x: 16, sq: 0.86 }, 'out'),
      step(400, 'sit', { x: 16 }),
    ],
    mods: [arc(440, 1020, HOP_HEIGHT)],
  }),
  post: (): Move => ({
    /* A long scratch up a tall post, paws high, then a look at the work. */
    steps: [
      step(600, 'rear', { fN: [21, -24], fF: [19, -14], hr: 0 }),
      step(3000, 'rear', { fN: [21, -24], fF: [19, -14], hr: 0 }),
      step(600, 'sit', { hr: -14 }),
      step(500, 'sit'),
    ],
    mods: [
      between(600, 3600, (p, s) => {
        p.fN[1] += 6 * Math.sin(s / 90);
        p.fF[1] -= 6 * Math.sin(s / 90);
      }),
    ],
    prop: 'post',
    propAt: (t) => ({
      ...still('post', POST_GAP),
      o: Math.min(1, t / 300, Math.max(0, (4700 - t) / 300)),
    }),
  }),
  box: (): Move => ({
    steps: [
      step(400, 'crouch'),
      step(140, 'crouch', { x: -2, sq: 0.9 }, 'in'),
      step(420, 'air', { x: 60 }, 'linear'),
      step(200, 'crouch', { x: 66, y: -5 }, 'out'),
      step(400, 'loaf', { x: 66, y: -5 }),
      step(1800, 'loaf', { x: 66, y: -5, hr: -6 }),
      step(160, 'crouch', { x: 66, y: -5 }, 'in'),
      step(420, 'air', { x: 130 }, 'linear'),
      step(200, 'crouch', { x: 134, sq: 0.85 }, 'out'),
      step(500, 'sit', { x: 134 }),
    ],
    mods: [arc(540, 1160, 26), arc(3520, 4140, 26)],
    prop: 'box',
    /* A snug box under the resting cat: head and back show over the low rim. */
    propAt: (t) => ({
      ...still('box', 70),
      o: Math.min(1, t / 300, Math.max(0, (4640 - t) / 300)),
    }),
  }),
  /* Bats the ball, trots after it as it rolls, pounces, bats it on, and catches it. */
  yarn: (): Move => ({
    steps: [
      step(300, 'sit', { fN: [20, 14] }, 'out'),
      step(400, 'sit'),
      step(300, 'stand'),
      step(2400, 'stand', { x: 150 }, 'inOut'),
      step(300, 'crouch', { x: 150 }),
      step(140, 'crouch', { x: 150, sq: 0.88 }, 'in'),
      step(300, 'air', { x: 185 }, 'linear'),
      step(180, 'crouch', { x: 205, sq: 0.84 }, 'out'),
      step(300, 'sit', { x: 205, fN: [20, 14] }, 'out'),
      step(250, 'stand', { x: 205 }),
      step(1500, 'stand', { x: 265 }, 'inOut'),
      step(250, 'crouch', { x: 265 }),
      step(140, 'crouch', { x: 265, sq: 0.88 }, 'in'),
      step(280, 'air', { x: 290 }, 'linear'),
      step(180, 'crouch', { x: 300, sq: 0.84 }, 'out'),
      ...flopTo('crouch', 'belly', 300),
      step(1500, 'belly', { x: 300 }),
      ...flopTo('belly', 'loaf', 300),
      step(500, 'sit', { x: 300 }),
    ],
    mods: [
      walking(1000, 3400),
      wiggle(3400, 3700),
      arc(3840, 4320, YARN_BOUND_HEIGHT),
      walking(4870, 6370),
      wiggle(6370, 6620),
      arc(6760, 7220, YARN_BOUND_HEIGHT),
      between(7920, 9420, (p, s) => {
        p.hN[0] += 6 * Math.sin(s / 60);
        p.hF[0] -= 6 * Math.sin(s / 60);
      }),
    ],
    prop: 'yarn',
    /* Rolls ahead and slows; batted again, it rolls on to where the last pounce lands. */
    propAt: (t) => {
      const first = Math.min(1, Math.max(0, (t - 150) / 3700));
      const second = Math.min(1, Math.max(0, (t - 4470) / 2300));
      const ease = (k: number) => 1 - (1 - k) ** 2;
      return {
        kind: 'yarn',
        x: 22 + ease(first) * 208 + ease(second) * 95,
        y: -6,
        r: first * 900 + second * 500,
        o: Math.min(1, t / 200, Math.max(0, (10620 - t) / 300)),
      };
    },
  }),
  peek: (): Move => ({
    steps: [
      step(900, 'sit'),
      step(450, 'sit', { y: -46, ears: 0.3 }),
      step(1100, 'sit', { y: -46 }),
      step(300, 'sit', { y: -34 }, 'out'),
      step(700, 'sit', { y: -34 }),
      step(400, 'sit'),
    ],
    mods: [],
  }),
  sleep: (): Move => ({
    steps: [
      step(600, 'loaf'),
      step(800, 'sleep'),
      step(BREATH_MS * BREATHS, 'sleep'),
    ],
    mods: [breathing(1400), dozing(1400)],
  }),
  wake: (): Move => ({
    steps: [step(500, 'loaf', { hr: -12 }), step(500, 'sit')],
    mods: [],
  }),
} satisfies Record<string, () => Move>;

export type MoveName = keyof typeof MOVES;

/** Small play moves run this much slower than drawn, so each one can be watched. */
const SLOW_PLAY = 1.5;
const SLOW_MOVES: ReadonlySet<MoveName> = new Set([
  'knead',
  'toy',
  'peek',
  'knock',
  'box',
]);

/** A move at `factor` of its speed, modifiers and prop included. */
const slower = (move: Move, factor: number): Move => {
  const propAt = move.propAt;
  return {
    ...move,
    steps: move.steps.map((s) => ({ ...s, ms: s.ms * factor })),
    mods: move.mods.map((mod) => ({
      from: mod.from * factor,
      to: mod.to * factor,
      apply: (p, s, k) => mod.apply(p, s / factor, k),
    })),
    propAt: propAt && ((t) => propAt(t / factor)),
  };
};

/** The move a cat plays: small play moves slowed down. */
export const moveToPlay = (name: MoveName): Move =>
  SLOW_MOVES.has(name) ? slower(MOVES[name](), SLOW_PLAY) : MOVES[name]();

/** Moves that carry the cat along its track; on a short track they are scaled to fit. */
export const TRAVEL_MOVES: ReadonlySet<MoveName> = new Set([
  'stalk',
  'fly',
  'yarn',
]);

/** A move with its sideways distances, the cat's and its prop's, scaled by `factor`. */
export const scaleTravel = (move: Move, factor: number): Move => {
  const propAt = move.propAt;
  return {
    ...move,
    steps: move.steps.map((s) => ({
      ...s,
      pose: { ...clonePose(s.pose), x: s.pose.x * factor },
    })),
    propAt:
      propAt &&
      ((t) => {
        const s = propAt(t);
        return { ...s, x: s.x * factor };
      }),
  };
};

/* Move factories are deterministic, so each name's extent is sampled once. */
const extents = new Map<MoveName, readonly [number, number]>();

/** Every move name, to warm moveExtent's cache before any is needed. */
export const MOVE_NAMES = Object.keys(MOVES) as MoveName[];

/** The extent of moveToPlay(name), computed on first use and then kept. */
export const moveExtent = (name: MoveName): readonly [number, number] => {
  const known = extents.get(name);
  if (known) return known;
  const found = extent(moveToPlay(name));
  extents.set(name, found);
  return found;
};

/*
 * Relative weights per cat, so each reads as herself. Every play move stays
 * possible for every cat, except peek, which is Hela's own: she hides behind her
 * card. Sleep and wake come from the nap clock, not from these.
 */
export const CAT_WEIGHTS: Record<CatId, Partial<Record<MoveName, number>>> = {
  /* The queen: the calmest, but she chases too; watching is one move among many. */
  minerva: {
    look: 6,
    yarn: 5,
    fly: 5,
    stretch: 5,
    knead: 5,
    lie: 4,
    post: 4,
    box: 4,
    stalk: 3,
    toy: 3,
    belly: 3,
    knock: 4,
    hop: 2,
    pounce: 2,
    bigJump: 2,
  },
  /* The conspirator: stalks, peeks and knocks the cup off, and chases yarn. */
  hela: {
    stalk: 9,
    peek: 7,
    yarn: 7,
    knock: 9,
    fly: 6,
    pounce: 4,
    look: 3,
    box: 3,
    toy: 3,
    hop: 2,
    bigJump: 2,
    post: 2,
    knead: 2,
    stretch: 2,
    belly: 2,
    lie: 1,
  },
  /* The baby: chases everything, yarn and flies most. */
  rudra: {
    yarn: 11,
    fly: 10,
    toy: 7,
    hop: 6,
    stalk: 5,
    pounce: 4,
    belly: 4,
    bigJump: 3,
    box: 3,
    knead: 2,
    post: 2,
    stretch: 2,
    look: 2,
    knock: 3,
    lie: 1,
  },
};

/*
 * A turn on the spot before a move that heads the other way: a small hop that
 * flips at its top, as a flat sticker cannot rotate. Squeezing the width
 * through zero reads as a thin sliver, not a cat.
 */
const TURN_RISE_MS = 160;
const TURN_FLIP_MS = 140;
const TURN_LAND_MS = 200;
const TURN_MS = TURN_RISE_MS + TURN_FLIP_MS + TURN_LAND_MS;
const TURN_HOP = 6;

export const withTurn = (move: Move, from: Pose): Move => {
  const propAt = move.propAt;
  const gather = { ...clonePose(from), sq: 0.94 };
  return {
    ...move,
    steps: [
      { ms: TURN_RISE_MS, pose: gather, ease: 'out' },
      { ms: TURN_FLIP_MS, pose: { ...gather, face: 1 }, ease: 'snap' },
      { ms: TURN_LAND_MS, pose: { ...clonePose(from), face: 1 }, ease: 'out' },
      ...move.steps,
    ],
    mods: [
      arc(TURN_RISE_MS - 60, TURN_RISE_MS + TURN_FLIP_MS + 60, TURN_HOP),
      ...move.mods.map((mod) => ({
        ...mod,
        from: mod.from + TURN_MS,
        to: mod.to + TURN_MS,
      })),
    ],
    propAt: propAt && ((t) => propAt(Math.max(0, t - TURN_MS))),
  };
};

/** px per second of a crouched creep, slower than a trot. */
const CREEP_SPEED = 45;
const CREEP_MIN_MS = 300;
const CREEP_READY_MS = 250;
const SETTLE_BACK_MS = 400;
/** Farther than this, a cat trots to the spot first and creeps only the last of it. */
const CREEP_REACH = 60;
/** px per second of a purposeful trot, twice the creep. */
const TROT_SPEED = 110;
const TROT_READY_MS = 250;

/** Trots, then creeps, `distance` ahead first, so an edge move starts at the track end from anywhere on it. */
/*
 * Also shuffles `settleBack` px back once the move is done, so a cat that crept
 * past its track's end finishes on it again.
 */
export const withApproach = (
  move: Move,
  distance: number,
  settleBack = 0,
): Move => {
  const trot = Math.max(0, distance - CREEP_REACH);
  const trotMs = trot > 0 ? (trot / TROT_SPEED) * 1000 : 0;
  const trotLead = trot > 0 ? TROT_READY_MS + trotMs : 0;
  const creep = Math.max(
    CREEP_MIN_MS,
    ((distance - trot) / CREEP_SPEED) * 1000,
  );
  const last = move.steps.at(-1)?.pose.x ?? 0;
  const lead = trotLead + CREEP_READY_MS + creep;
  const propAt = move.propAt;
  return {
    ...move,
    steps: [
      ...(trot > 0
        ? [
            step(TROT_READY_MS, 'stand'),
            step(trotMs, 'stand', { x: trot }, 'inOut'),
          ]
        : []),
      step(CREEP_READY_MS, 'crouch', { x: trot }),
      step(creep, 'crouch', { x: distance }),
      ...move.steps.map((s) => ({
        ...s,
        pose: { ...clonePose(s.pose), x: s.pose.x + distance },
      })),
      ...(settleBack > 0
        ? [step(SETTLE_BACK_MS, 'sit', { x: distance + last - settleBack })]
        : []),
    ],
    mods: [
      ...(trot > 0 ? [walking(TROT_READY_MS, trotLead)] : []),
      walking(trotLead + CREEP_READY_MS, lead, 0.6),
      ...move.mods.map((mod) => ({
        ...mod,
        from: mod.from + lead,
        to: mod.to + lead,
      })),
    ],
    propAt:
      propAt &&
      ((t) => {
        const s = propAt(Math.max(0, t - lead));
        return { ...s, x: s.x + distance, o: t < lead ? 0 : s.o };
      }),
  };
};

/** One 60fps frame, the step of extent's sampling. */
const EXTENT_STEP_MS = 1000 / 60;

/** A move's path back and forward from its start, for track checks: sampled from the drawn path, so eases and modifiers count. */
const extent = (move: Move): [number, number] => {
  const start = pose('sit');
  const length = duration(move);
  let back = 0;
  let forward = 0;
  for (let t = 0; t <= length + EXTENT_STEP_MS; t += EXTENT_STEP_MS) {
    const x = poseAt(move, start, Math.min(t, length)).x;
    back = Math.min(back, x);
    forward = Math.max(forward, x);
  }
  return [back, forward];
};

const sample = (steps: Step[], start: Pose, t: number): Pose => {
  let from = start;
  let at = 0;
  for (const s of steps) {
    if (t <= at + s.ms)
      return mixPose(from, s.pose, EASE[s.ease]((t - at) / s.ms));
    at += s.ms;
    from = s.pose;
  }
  return clonePose(from);
};

/** A move's pose `t` ms in, from `start`, with its modifiers applied. */
export const poseAt = (move: Move, start: Pose, t: number): Pose => {
  const p = sample(move.steps, start, t);
  for (const mod of move.mods) {
    if (t >= mod.from && t <= mod.to)
      mod.apply(p, t - mod.from, (t - mod.from) / (mod.to - mod.from || 1));
  }
  return p;
};

const stepsDuration = (steps: Step[]): number =>
  steps.reduce((sum, s) => sum + s.ms, 0);

export const duration = (move: Move): number => stepsDuration(move.steps);
