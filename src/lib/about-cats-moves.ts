/*
 * Poses and moves for the About cats. A move is a timeline of poses plus
 * modifiers; x runs forward in the direction the cat faces when it starts, and
 * `face: -1` means turned round. about-cats.ts places moves on a track.
 */
import type { PropKind, PropState } from './about-cats-rig';

type Pair = [number, number];

export interface Pose {
  x: number;
  y: number;
  face: number;
  /** Body angle in degrees, front up. */
  ba: number;
  /** Body centre's height above the ground. */
  by: number;
  /** Body thickness. */
  bt: number;
  /** Squash (below 1) and stretch (above 1). */
  sq: number;
  haunch: number;
  /** Paw targets from the body centre: near and far front, near and far hind. */
  fN: Pair;
  fF: Pair;
  hN: Pair;
  hF: Pair;
  hx: number;
  hy: number;
  hr: number;
  /** Tail base angle, curl per segment, and tip twitch amplitude. */
  ta: number;
  tc: number;
  tw: number;
  eyes: number;
  ears: number;
  rot: number;
  mouth: number;
  zz: number;
}

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

export const POSES = {
  stand: BASE,
  sit: SIT,
  loaf: LOAF,
  sleep: derive(LOAF, {
    hx: 9,
    hy: -3,
    hr: 14,
    eyes: 0,
    ears: 0.25,
    ta: 170,
    tc: -24,
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
    ta: 200,
    tc: -2,
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
    ta: 215,
    tc: 4,
  }),
} satisfies Record<string, Pose>;

export type PoseName = keyof typeof POSES;

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

export const EASE = {
  linear: (k: number) => k,
  inOut: (k: number) => (k < 0.5 ? 4 * k ** 3 : 1 - (-2 * k + 2) ** 3 / 2),
  out: (k: number) => 1 - (1 - k) ** 3,
  in: (k: number) => k ** 3,
  back: (k: number) => 1 + 2.4 * (k - 1) ** 3 + 1.4 * (k - 1) ** 2,
} as const;

export type Ease = keyof typeof EASE;

export interface Step {
  ms: number;
  pose: Pose;
  ease: Ease;
}

export interface Mod {
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
  /** Needs the cat at a track end, facing out: the cup goes over the edge. */
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

export const gait = (p: Pose, distance: number, strength = 1): void => {
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
export const blinkAt = (at: number): Mod =>
  between(at, at + 160, (p) => {
    p.eyes = 0;
  });
const arc = (from: number, to: number, height: number): Mod =>
  between(from, to, (p, _s, k) => {
    p.y += Math.sin(Math.PI * k) * height;
  });
const earFlick = (at: number): Mod =>
  between(at, at + 280, (p, _s, k) => {
    p.ears = Math.max(p.ears, Math.sin(Math.PI * k) * 0.6);
  });

/** The big jump's arc; with it the tallest move stays under --spacing-cat-band. */
export const JUMP_HEIGHT = 34;

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
    mods: [wiggle(400, 1300), arc(1440, 1840, 18)],
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
      step(700, 'belly'),
      step(1600, 'belly'),
      step(700, 'loaf'),
      step(500, 'sit'),
    ],
    mods: [
      between(1200, 2800, (p, s) => {
        p.fN[0] += 4 * Math.sin(s / 90);
        p.fF[0] -= 4 * Math.sin(s / 90 + 1);
        p.hN[0] += 5 * Math.sin(s / 70);
        p.hF[0] -= 5 * Math.sin(s / 70);
      }),
    ],
  }),
  zoomies: (): Move => ({
    steps: [
      step(300, 'stand'),
      step(550, 'stand', { x: 170, ba: -4 }, 'in'),
      step(160, 'stand', { x: 185, ba: -10 }, 'out'),
      step(240, 'stand', { x: 185, face: -1 }),
      step(550, 'stand', { x: 15, face: -1, ba: -4 }, 'in'),
      step(160, 'stand', { x: 0, face: -1, ba: -10 }, 'out'),
      step(240, 'stand'),
      step(500, 'sit'),
    ],
    mods: [walking(300, 1010, 1.6), walking(1250, 1960, 1.6)],
  }),
  fly: (): Move => ({
    steps: [
      step(1800, 'sit'),
      step(400, 'rear'),
      step(160, 'rear', { fN: [16, -22], fF: [16, -20] }, 'out'),
      step(600, 'sit'),
    ],
    mods: [
      between(0, 2300, (p, s) => {
        p.hr = -18 + 14 * Math.sin(s / 260);
      }),
    ],
    prop: 'fly',
    propAt: (t) => {
      const away = Math.min(1, Math.max(0, (t - 2300) / 600));
      return {
        kind: 'fly',
        x: 26 + 16 * Math.sin(t / 260) + away * 50,
        y: -62 + 10 * Math.sin(t / 170) - away * 30,
        r: 0,
        o: 1 - away,
      };
    },
  }),
  post: (): Move => ({
    steps: [
      step(500, 'rear', { fN: [14, -16], fF: [13, -8], hr: 0 }),
      step(1800, 'rear', { fN: [14, -16], fF: [13, -8], hr: 0 }),
      step(500, 'sit'),
      step(400, 'sit'),
    ],
    mods: [
      between(500, 2300, (p, s) => {
        p.fN[1] += 5 * Math.sin(s / 80);
        p.fF[1] -= 5 * Math.sin(s / 80);
      }),
    ],
    prop: 'post',
    propAt: (t) => ({
      ...still('post', 22),
      o: Math.min(1, t / 300, Math.max(0, (3200 - t) / 300)),
    }),
  }),
  box: (): Move => ({
    steps: [
      step(400, 'crouch'),
      step(140, 'crouch', { x: -2, sq: 0.9 }, 'in'),
      step(420, 'air', { x: 60 }, 'linear'),
      step(200, 'loaf', { x: 66, y: -10 }, 'out'),
      step(1600, 'loaf', { x: 66, y: -10, hr: -6 }),
      step(160, 'crouch', { x: 66, y: -6 }, 'in'),
      step(420, 'air', { x: 130 }, 'linear'),
      step(200, 'crouch', { x: 134, sq: 0.85 }, 'out'),
      step(500, 'sit', { x: 134 }),
    ],
    mods: [arc(540, 960, 26), arc(2500, 2920, 26)],
    prop: 'box',
    /* Centred under the loaf's body, so only the head shows over the rim. */
    propAt: (t) => ({
      ...still('box', 72),
      o: Math.min(1, t / 300, Math.max(0, (4040 - t) / 300)),
    }),
  }),
  yarn: (): Move => ({
    steps: [
      step(300, 'sit', { fN: [20, 14] }, 'out'),
      step(400, 'sit'),
      step(1400, 'stand', { x: 90 }),
      step(500, 'belly', { x: 90 }),
      step(1500, 'belly', { x: 90 }),
      step(600, 'loaf', { x: 90 }),
      step(500, 'sit', { x: 90 }),
    ],
    mods: [
      walking(700, 2100),
      between(2600, 4100, (p, s) => {
        p.hN[0] += 6 * Math.sin(s / 60);
        p.hF[0] -= 6 * Math.sin(s / 60);
      }),
    ],
    prop: 'yarn',
    propAt: (t) => {
      const k = Math.min(1, Math.max(0, (t - 150) / 1200));
      return {
        kind: 'yarn',
        x: 22 + (1 - (1 - k) ** 3) * 88,
        y: -6,
        r: k * 520,
        o: Math.min(1, t / 200, Math.max(0, (5200 - t) / 300)),
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
    steps: [step(600, 'loaf'), step(700, 'sleep')],
    mods: [],
  }),
  wake: (): Move => ({
    steps: [step(500, 'loaf', { hr: -12 }), step(500, 'sit')],
    mods: [],
  }),
} satisfies Record<string, () => Move>;

export type MoveName = keyof typeof MOVES;

/** Relative weights; calm moves dominate so the cats mostly rest. */
export const WEIGHTS: Partial<Record<MoveName, number>> = {
  look: 28,
  lie: 22,
  stalk: 5,
  pounce: 7,
  bigJump: 5,
  stretch: 6,
  knead: 5,
  toy: 3,
  knock: 3,
  belly: 4,
  zoomies: 2,
  fly: 3,
  post: 3,
  box: 3,
  yarn: 3,
};

/** Hela hides behind her card now and then. */
export const HELA_WEIGHTS: Partial<Record<MoveName, number>> = {
  ...WEIGHTS,
  peek: 8,
};

/** px per second. */
export const WALK_SPEED = 60;

/** Walks to a spot `distance` ahead, stride-locked. */
export const walkMove = (distance: number): Move => {
  const ms = Math.max(400, (Math.abs(distance) / WALK_SPEED) * 1000);
  return {
    steps: [
      step(250, 'stand'),
      step(ms, 'stand', { x: distance }),
      step(300, 'sit', { x: distance }),
    ],
    mods: [walking(0, 250 + ms)],
  };
};

/** Extent of a move's path, back and forward from its start, for track checks. */
export const extent = (move: Move): [number, number] => {
  let back = 0;
  let forward = 0;
  for (const s of move.steps) {
    back = Math.min(back, s.pose.x);
    forward = Math.max(forward, s.pose.x);
  }
  return [back, forward];
};

export const sample = (steps: Step[], start: Pose, t: number): Pose => {
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

export const duration = (move: Move): number =>
  move.steps.reduce((sum, s) => sum + s.ms, 0);
