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
    by: 9,
    bt: 24,
    sq: 0.86,
    hx: 13,
    hy: 5,
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
    fN: [11, 15],
    fF: [6, 17],
    hN: [-11, 15],
    hF: [-6, 17],
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

export const mixPose = (a: Pose, b: Pose, k: number): Pose => {
  const out = clonePose(b);
  for (const key of Object.keys(b) as (keyof Pose)[]) {
    const va = a[key];
    const vb = b[key];
    if (Array.isArray(va) && Array.isArray(vb)) {
      (out[key] as Pair) = [lerp(va[0], vb[0], k), lerp(va[1], vb[1], k)];
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

/** Stride in px per half cycle; the legs lock to distance, so paws never slide. */
const STRIDE = 13;

const gait = (p: Pose, distance: number, strength = 1): void => {
  const phase = (distance / STRIDE) * Math.PI;
  const legs: [keyof Pick<Pose, 'fN' | 'fF' | 'hN' | 'hF'>, number][] = [
    ['fN', 0],
    ['hF', 0.5],
    ['fF', 1],
    ['hN', 1.5],
  ];
  for (const [leg, offset] of legs) {
    const s = phase + offset * Math.PI;
    p[leg][0] += Math.sin(s) * 6 * strength;
    p[leg][1] -= Math.max(0, Math.cos(s)) * 4 * strength;
  }
  p.y += Math.abs(Math.sin(phase)) * 0.8;
  p.hy += Math.sin(phase * 2) * 0.4;
};

const walking = (from: number, to: number, strength = 1): Mod =>
  between(from, to, (p) => gait(p, p.x, strength));
const wiggle = (from: number, to: number): Mod =>
  between(from, to, (p, s) => {
    p.x += 0.6 * Math.sin(s / 45);
    p.hN[0] += 1.5 * Math.sin(s / 45);
    p.tw = 6;
  });
const blinkAt = (at: number): Mod =>
  between(at, at + 160, (p) => {
    p.eyes = 0;
  });
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
/* The yarn chase: a trot of 120px in 2.2 s, then a pounce. */
const YARN_TROT = 120;
const YARN_TROT_MS = 2200;
const YARN_CATCH = YARN_TROT + 42;

/*
 * Rolling onto the back: low, then over all at once with a small flop. Easing
 * the 180° roll would stand the cat on its head halfway.
 */
const FLOP_HOP = 4;
const flopTo = (from: PoseName, to: PoseName, x = 0): Step[] => [
  step(200, from, { x, by: 9, sq: 0.92 }, 'in'),
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
  stalk: (): Move => ({
    steps: [
      step(400, 'crouch'),
      step(2000, 'crouch', { x: 80 }, 'linear'),
      step(700, 'crouch', { x: 80 }),
      step(140, 'crouch', { x: 78, sq: 0.9 }, 'in'),
      step(400, 'air', { x: 128 }, 'linear'),
      step(150, 'crouch', { x: 134, sq: 0.84 }, 'out'),
      step(280, 'crouch', { x: 134 }, 'back'),
      step(500, 'sit', { x: 134 }),
    ],
    mods: [
      walking(400, 2400, 0.6),
      between(400, 3100, (p) => {
        p.tw = 4;
      }),
      wiggle(2400, 3100),
      arc(3240, 3640, 16),
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
    mods: [wiggle(400, 1300), arc(1440, 1840, POUNCE_HEIGHT)],
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
  knead: (): Move => ({
    steps: [
      step(500, 'knead'),
      step(2600, 'knead'),
      step(500, 'loaf'),
      step(500, 'sit'),
    ],
    prop: 'blanket',
    propAt: (t) => ({ ...still('blanket', 12), o: Math.min(1, t / 300) }),
    mods: [
      between(500, 3100, (p, s) => {
        const w = Math.sin(s / 170);
        p.fN[1] -= 4 * Math.max(0, w);
        p.fF[1] -= 4 * Math.max(0, -w);
        p.hy += 0.4 * w;
      }),
    ],
  }),
  toy: (): Move => {
    const hit = (t: number, at: number): number =>
      t > at ? 30 * Math.exp(-(t - at) / 600) * Math.sin((t - at) / 120) : 0;
    return {
      steps: [
        step(700, 'sit', { hr: -15 }),
        step(160, 'sit', { hr: -18, fN: [20, -18] }, 'out'),
        step(500, 'sit', { hr: -15 }),
        step(400, 'rear'),
        step(160, 'rear', { fN: [18, -22], fF: [16, -18] }, 'out'),
        step(260, 'rear'),
        step(160, 'rear', { fN: [18, -22], fF: [16, -18] }, 'out'),
        step(500, 'sit'),
        step(600, 'sit'),
      ],
      mods: [],
      prop: 'toy',
      propAt: (t) => ({
        kind: 'toy',
        x: 28,
        y: -32 + 4 * Math.sin(t / 700),
        r: hit(t, 860) + hit(t, 1900) + hit(t, 2320),
        o: Math.min(1, t / 300, Math.max(0, (3440 - t) / 400)),
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
  /* Watches the fly, crouches, leaps straight up for it, and the fly gets away. */
  fly: (): Move => ({
    steps: [
      step(1400, 'sit'),
      step(300, 'crouch', { x: 4 }),
      step(500, 'crouch', { x: 4 }),
      step(160, 'crouch', { x: 4, sq: 0.86 }, 'in'),
      step(260, 'leap', { x: 12 }, 'out'),
      step(260, 'leap', { x: 16 }, 'in'),
      step(150, 'crouch', { x: 18, sq: 0.84 }, 'out'),
      step(500, 'sit', { x: 18 }),
    ],
    mods: [
      between(0, 1700, (p, s) => {
        p.hr = -18 + 14 * Math.sin(s / 260);
      }),
      wiggle(1700, 2200),
      arc(2360, 2880, LEAP_HEIGHT),
    ],
    prop: 'fly',
    propAt: (t) => {
      const away = Math.min(1, Math.max(0, (t - 2620) / 600));
      return {
        kind: 'fly',
        x: 26 + 16 * Math.sin(t / 260) + away * 50,
        y: -62 + 10 * Math.sin(t / 170) - away * 30,
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
    mods: [arc(440, 880, HOP_HEIGHT)],
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
    mods: [arc(540, 960, 26), arc(3520, 3940, 26)],
    prop: 'box',
    /* A snug box under the resting cat: head and back show over the low rim. */
    propAt: (t) => ({
      ...still('box', 70),
      o: Math.min(1, t / 300, Math.max(0, (4640 - t) / 300)),
    }),
  }),
  /*
   * Bats the ball and follows it at a steady, stride-locked trot as it slows,
   * then crouches and pounces onto it and kicks it: one long, even chase.
   */
  yarn: (): Move => ({
    steps: [
      step(300, 'sit', { fN: [20, 14] }, 'out'),
      step(400, 'sit'),
      step(300, 'stand'),
      step(YARN_TROT_MS, 'stand', { x: YARN_TROT }, 'inOut'),
      step(300, 'crouch', { x: YARN_TROT }),
      step(140, 'crouch', { x: YARN_TROT, sq: 0.88 }, 'in'),
      step(300, 'air', { x: YARN_TROT + 30 }, 'linear'),
      step(180, 'crouch', { x: YARN_CATCH, sq: 0.84 }, 'out'),
      ...flopTo('crouch', 'belly', YARN_CATCH),
      step(1500, 'belly', { x: YARN_CATCH }),
      ...flopTo('belly', 'loaf', YARN_CATCH),
      step(500, 'sit', { x: YARN_CATCH }),
    ],
    mods: [
      walking(1000, 1000 + YARN_TROT_MS),
      wiggle(1000 + YARN_TROT_MS, 1300 + YARN_TROT_MS),
      arc(1440 + YARN_TROT_MS, 1740 + YARN_TROT_MS, YARN_BOUND_HEIGHT),
      between(2620 + YARN_TROT_MS, 4120 + YARN_TROT_MS, (p, s) => {
        p.hN[0] += 6 * Math.sin(s / 60);
        p.hF[0] -= 6 * Math.sin(s / 60);
      }),
    ],
    prop: 'yarn',
    /* The ball rolls on ahead, slowing, and stops where the pounce lands. */
    propAt: (t) => {
      const k = Math.min(1, Math.max(0, (t - 150) / (YARN_TROT_MS + 600)));
      return {
        kind: 'yarn',
        x: 22 + (1 - (1 - k) ** 2) * (YARN_CATCH + 10 - 22),
        y: -6,
        r: k * 900,
        o: Math.min(1, t / 200, Math.max(0, (5320 + YARN_TROT_MS - t) / 300)),
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
  'yarn',
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
  /* The queen: watches, rests and grooms the blanket; rarely leaps. */
  minerva: {
    look: 12,
    lie: 8,
    stretch: 6,
    knead: 6,
    post: 5,
    box: 5,
    fly: 4,
    toy: 3,
    yarn: 3,
    belly: 3,
    knock: 3,
    hop: 2,
    pounce: 2,
    bigJump: 2,
    stalk: 1,
  },
  /* The conspirator: peeks, stalks and knocks the cup off. */
  hela: {
    peek: 9,
    knock: 7,
    stalk: 6,
    pounce: 5,
    look: 5,
    box: 4,
    fly: 4,
    toy: 3,
    yarn: 3,
    hop: 3,
    bigJump: 3,
    post: 3,
    knead: 3,
    stretch: 3,
    lie: 3,
    belly: 2,
  },
  /* The baby: hops and chases every toy. */
  rudra: {
    hop: 9,
    toy: 9,
    yarn: 8,
    fly: 7,
    pounce: 5,
    belly: 5,
    bigJump: 4,
    box: 4,
    knead: 3,
    post: 3,
    stretch: 3,
    look: 3,
    lie: 2,
    knock: 2,
    stalk: 2,
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

/** Creeps `distance` ahead in a crouch first, so an edge move starts at the track end. */
/*
 * Also shuffles `settleBack` px back once the move is done, so a cat that crept
 * past its track's end finishes on it again.
 */
export const withApproach = (
  move: Move,
  distance: number,
  settleBack = 0,
): Move => {
  const creep = Math.max(CREEP_MIN_MS, (distance / CREEP_SPEED) * 1000);
  const last = move.steps.at(-1)?.pose.x ?? 0;
  const lead = CREEP_READY_MS + creep;
  const propAt = move.propAt;
  return {
    ...move,
    steps: [
      step(CREEP_READY_MS, 'crouch'),
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
      walking(CREEP_READY_MS, lead, 0.6),
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

export const duration = (move: Move): number =>
  move.steps.reduce((sum, s) => sum + s.ms, 0);
