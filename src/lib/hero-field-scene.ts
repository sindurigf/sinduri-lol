/*
 * The homepage hero: a field of bare stems with a hare hopping through it.
 *
 * This module is the whole simulation and all of the drawing. It knows about
 * a `CanvasRenderingContext2D` and nothing else: no DOM, no window, no Vue.
 * HeroField.vue owns the canvases, the animation frame and the pause control.
 * Everything below is deterministic given a seed and a box.
 *
 * IT DRAWS IN CSS PIXELS, AND EVERY PROPORTION IS A FRACTION OF THE HERO.
 *
 * Every constant here was tuned against a 1440x780 comp: horizon height, stem
 * counts per band, spring stiffness, the hare's proportions, how far the wind
 * moves a stalk at each distance. Rescaling those individually for a fluid
 * hero would be dozens of separate judgement calls.
 *
 * Instead there are two numbers. The horizon is a fixed fraction of the
 * hero's height, so sky and ground split the frame the same way at any size.
 * The projection, which sets how big everything is, is that height times an
 * aspect factor, 1 at the comp's proportions and smaller on a narrower frame.
 * Nothing else is a hardcoded size: every stem height, hop length, wind
 * amplitude and spring reach is expressed against the projection, so all of
 * it moves together. See `FIELD_OF_VIEW_FLOOR` for why the factor exists.
 *
 * THE PROJECTION IS THE WHOLE DESIGN.
 *
 * Every stem has a real distance `z`. Its root lands at
 * `horizon + projection / z` and its apparent size is
 * `projection / (532 * z)`; height, line width, opacity, bud size, bud count
 * and wind travel are all read off that one number. Deriving each of them
 * from depth by its own formula gives scattered sticks rather than ground
 * going away from you: a stem rooted just below the horizon can still tower
 * above it.
 *
 * A stem's height is a fraction of the camera's eye height rather than a free
 * number, which is why the band heights below are all around 1. A plant
 * shorter than you never crosses the horizon at any distance and a taller one
 * always does, which is most of what makes a field look like a field.
 *
 * The horizon is never drawn: drawing it announces the perspective instead of
 * letting it be felt. `veil`, a band of light, and `floor`, weighting the
 * bottom edge, stand in for it.
 */

/**
 * The colours the field draws in, read from the `--color-*` custom properties
 * by the component rather than named here.
 *
 * `scripts/check-tokens.mjs` fails the build on a raw hex in any `.ts` or
 * `.vue` file: a copied palette drifts. Reading the live values also means
 * the field follows a retoned token without knowing it changed.
 */
export interface HeroPalette {
  /** `--color-border`. The stems themselves. */
  readonly border: string;
  /** `--color-text`. The hare's outline, and its eye. */
  readonly text: string;
  /** `--color-subtle`. Buds on about a third of the stems. */
  readonly subtle: string;
  /** `--color-muted`. Buds on about a fifth, the warmest thing in the scene. */
  readonly muted: string;
  /**
   * `--color-background`. Filled into the hare's body before its outline is
   * stroked, so the legs and ears behind it do not show through. It has to be
   * the real page colour and not `transparent`, because knocking a hole in the
   * layer is exactly the point.
   */
  readonly background: string;
}

export interface HeroField {
  /**
   * Generate the field for a box, in CSS pixels. Call on first paint and on
   * resize. Cheap enough to call from a resize handler, though the component
   * debounces anyway because it also has canvases to resize.
   */
  layout(width: number, height: number): void;
  /**
   * How far out of focus the near layer should be, in CSS pixels. It belongs to
   * the field rather than to the component because it has to shrink with the
   * projection: a fixed blur over a scene drawn half the size is twice the blur.
   */
  nearBlur(): number;
  /** Advance the stem springs. Once per animation frame, never once per layer. */
  step(seconds: number, delta: number): void;
  /** Behind the hare: the distance, the horizon veil, the middle ground. */
  back(ctx: CanvasRenderingContext2D, seconds: number): void;
  /** The hare, and the stems standing between it and you. */
  mid(ctx: CanvasRenderingContext2D, seconds: number): void;
  /** The nearest stems, which the component blurs. */
  near(ctx: CanvasRenderingContext2D, seconds: number): void;
}

/* ------------------------------------------------------------------ *
 * Geometry
 * ------------------------------------------------------------------ */

/** The box every constant in this file was tuned against. */
export const REFERENCE_HEIGHT = 780;
export const REFERENCE_WIDTH = 1440;
export const REFERENCE_ASPECT = REFERENCE_WIDTH / REFERENCE_HEIGHT;

/** Eye level at the reference box. Never drawn; see the module note. */
export const HORIZON_RATIO = 398 / REFERENCE_HEIGHT;

/** Where the nearest ground lands, comfortably below the bottom edge. */
export const GROUND_RATIO = 930 / REFERENCE_HEIGHT;

/** How much of the reference box lies between the horizon and the nearest ground. */
export const GROUND_SPAN = GROUND_RATIO - HORIZON_RATIO;

/** Focal length times eye height at the reference box, which everything scales against. */
export const REFERENCE_PROJECTION = GROUND_SPAN * REFERENCE_HEIGHT;

/**
 * The nearest distance anything is planted at across the full width, expressed
 * as the depth whose root sits exactly on the hero's bottom edge.
 *
 * The horizon is derived from it, not the other way round. Fixing the horizon
 * at 51% and shortening the projection for a narrow frame leaves the ground
 * stretched: on a 390x748 phone the depths planted across the whole width
 * reached only a third of the way down from the horizon, and the bottom
 * quarter of the hero was bare.
 *
 * Deriving it this way, the horizon sits wherever it must for the nearest
 * planted depth to land on the bottom edge, so the ground is always full and
 * the leftover height becomes sky, which on a portrait screen is where the
 * type already is. At the comp's proportions it resolves to 51%.
 */
export const BOTTOM_DEPTH = GROUND_SPAN / (1 - HORIZON_RATIO);

/**
 * How wide a swath of field the hero shows, and why that is not just its
 * height.
 *
 * Anchoring the projection to height alone is right for a landscape band and
 * wrong for a portrait one: on a 390x748 phone hero the nearest stems came
 * out at 130% of the width and the hare at 23% of the screen across, where
 * the comp draws it at 7%. A taller frame was being treated as a reason to
 * move the camera closer.
 *
 * So the projection is scaled by how far the hero's aspect falls short of the
 * comp's, floored so it never becomes a wide-angle caricature. At the comp's
 * proportions the factor is 1 and the tuned scene is unchanged; on that phone
 * it bottoms out here, bringing the hare to 16% of the width. Lower and the
 * phone hero is two thirds empty sky; higher and the hare fills the screen.
 *
 * The floor is also the nearest distance any stem is placed at, and that is
 * not a coincidence: shortening the projection moves the nearest ground up
 * the frame, and `nearest z` is `projection / (ground - horizon)`, which is
 * the factor.
 */
export const FIELD_OF_VIEW_FLOOR = 0.68;

/** Nearer than this is the out-of-focus foreground the component blurs. */
export const FRONT_DEPTH = 1.55;

/** Depth of field on that layer, at the reference projection. */
export const NEAR_BLUR = 2.6;

/**
 * The hare's distance. At this depth about thirty stems stand in front of it,
 * so it goes behind cover and comes out again, and being briefly hidden is
 * what makes the field feel like it has depth to hide in. Nearer and it looks
 * placed on the scene rather than in it; further and it stops being the thing
 * you follow.
 */
export const HARE_DEPTH = 2.45;

/**
 * Converts apparent projection size to the hare's drawing scale. Derived rather
 * than chosen: it is the scale the comp used at this depth, divided by the
 * apparent size at this depth, so the hare scales with the projection instead
 * of alongside it.
 */
export const HARE_UNIT = 1.167 / (REFERENCE_PROJECTION / HARE_DEPTH);

/** Where the hare's feet plant, in its own drawing units. */
export const FOOT_Y = 20;

/* ------------------------------------------------------------------ *
 * Stems
 * ------------------------------------------------------------------ */

export interface Stem {
  /** Distance from the camera. Everything else is derived from it. */
  readonly z: number;
  /**
   * Depth, `1 / z`. Drives opacity and nothing else: how faint a thing is
   * carries how far away it is, and that should not change with the frame.
   */
  readonly scale: number;
  /**
   * Apparent size, relative to the reference box. Drives line weight, bud size,
   * how far the wind moves it and how close the hare has to pass to disturb it.
   * Identical to `scale` at the comp's proportions and smaller on a narrow
   * hero, which is what makes the whole scene step back rather than just the
   * stem heights.
   */
  readonly size: number;
  readonly x: number;
  readonly root: number;
  /** Apparent height in reference units. */
  readonly height: number;
  /** Picks the bud colour. */
  readonly tone: number;
  /** Per-stem wind phase, so a row of them does not sway in lockstep. */
  readonly phase: number;
  /** Opacity multiplier. Only the near frame uses anything but 1. */
  readonly veil: number;
  /** Current spring displacement, in reference units at the tip. */
  lean: number;
  leanRate: number;
}

/**
 * Stem counts at the reference width, scaled by however wide the field
 * actually is.
 *
 * `HARE` is the densest band and straddles the hare's own depth, so roughly
 * half of it stands in front of the animal. Thinned out, a crossing passes
 * near almost nothing and the hare never appears to touch the field.
 *
 * `GRASS` carries no buds. It exists because distance drawn as a handful of
 * isolated stalks reads as sticks in a void.
 */
/* `NEAR.near` is 0 as a placeholder: the nearest distance is the aspect factor,
   which is not known until `layout` sees the box. */
export const BANDS = {
  FAR: { count: 46, near: 4.2, far: 62, height: [0.6, 0.75] },
  GRASS: { count: 132, near: 9, far: 62, height: [0.2, 0.52] },
  MIDDLE: { count: 30, near: 2.6, far: 4.2, height: [0.58, 0.72] },
  HARE: { count: 42, near: 1.7, far: 2.9, height: [0.34, 0.6] },
  NEAR: { count: 5, near: 0, far: 1.7, height: [0.78, 0.6] },
} as const;

/** Clump centres at the reference width. A real field does not scatter evenly. */
export const CLUMP_COUNT = 16;

/** Opacity multiplier on the near frame, which otherwise pulls the eye. */
export const NEAR_VEIL = 0.72;

/* ------------------------------------------------------------------ *
 * The springs
 * ------------------------------------------------------------------ */

/**
 * Stem stiffness, damping, and how hard the hare hits.
 *
 * At these values a stem leans 40 to 75 reference units depending on how fast
 * the hare is going, fifteen to twenty degrees on a 180-unit stem. Weaker,
 * and the deflection disappears under a breeze that already sways those stems
 * 28 units, so the contact exists in the code and not on the screen.
 *
 * The damping ratio is about 0.4, so a stem overshoots and settles over
 * roughly a second. That recovery, not the deflection, is what reads as being
 * brushed: a stem released the instant the hare passes reads as nothing.
 */
export const SPRING = { stiffness: 42, damping: 5, impulse: 9 } as const;

/** Beyond this fraction of the hare's own depth, it disturbs nothing. */
export const REACH_DEPTH = 0.34;

/** A stem it has already passed is shoved harder than one it is approaching. */
export const REACH_BEHIND = 1.35;
export const REACH_AHEAD = 0.7;

/** Stops a pathological dt from folding a stem in half, as a share of the projection. */
export const LEAN_LIMIT_RATIO = 110 / REFERENCE_PROJECTION;

/** Anything faster than this is the route wrapping from one edge to the other. */
export const SPEED_LIMIT_RATIO = 900 / REFERENCE_PROJECTION;

/* ------------------------------------------------------------------ *
 * The route
 * ------------------------------------------------------------------ */

export interface Segment {
  readonly kind: 'hop' | 'rest';
  readonly duration: number;
  readonly x0: number;
  readonly x1: number;
  readonly hop: number;
  start: number;
}

export interface RoutePoint {
  readonly x: number;
  /** Position within the current hop, 0 to 1. */
  readonly cycle: number;
  /** How far into a sit, 0 to 1. */
  readonly sit: number;
  readonly hop: number;
}

export interface Route {
  readonly segments: readonly Segment[];
  readonly total: number;
}

/**
 * Hop lengths and their heights, with the odds of each.
 *
 * The table exists so the hare is not metronomic. Four lengths, weighted so
 * the middle one is commonest, plus two kinds of rest, a short pause and a
 * proper sit, which can only follow three hops so it never stutters. A hop's
 * duration comes from its length, so a long leap takes longer and the fast
 * ones do not look like a skip.
 */
export const HOPS = [
  { odds: 0.22, distance: 74, height: 30 },
  { odds: 0.66, distance: 122, height: 56 },
  { odds: 0.9, distance: 172, height: 82 },
  { odds: 1, distance: 228, height: 118 },
] as const;

export const REST_ODDS = 0.26;
export const REST_MIN_HOPS = 3;
export const REST_LONG_ODDS = 0.42;
export const REST_LONG = 2.4;
export const REST_SHORT = 1;

/** How far off each edge the hare starts and finishes, in reference units. */
export const ROUTE_MARGIN = 170;

/* ------------------------------------------------------------------ *
 * Seeds
 * ------------------------------------------------------------------ */

/*
 * Fixed seeds, so the field is the same on every load and every machine. A
 * hero that regenerates itself each visit cannot be approved and makes a
 * screenshot diff meaningless.
 */
export const FIELD_SEED = 4211;
export const ROUTE_SEED = 8171;

/** Numerical Recipes' LCG. Deterministic, and fast enough to call thousands of times. */
export const random = (seed: number): (() => number) => {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
};

/* ------------------------------------------------------------------ *
 * Drawing helpers
 * ------------------------------------------------------------------ */

/**
 * A point along a stem's curve, `f` from root to tip.
 *
 * An explicit cubic rather than a walk along the path, because the buds hang
 * off the same curve the stroke draws and a canvas cannot be asked where a
 * path went.
 */
export const stemPoint = (
  x: number,
  root: number,
  height: number,
  lean: number,
  f: number,
): readonly [number, number] => {
  const m = 1 - f;
  const x1 = x + lean * 0.18;
  const y1 = root - height * 0.45;
  const x2 = x + lean * 0.62;
  const y2 = root - height * 0.8;
  return [
    m * m * m * x +
      3 * m * m * f * x1 +
      3 * m * f * f * x2 +
      f * f * f * (x + lean),
    m * m * m * root +
      3 * m * m * f * y1 +
      3 * m * f * f * y2 +
      f * f * f * (root - height),
  ];
};

/** Two sines at different rates, so the wind never visibly repeats. */
export const breeze = (x: number, phase: number, seconds: number): number =>
  Math.sin(x * 0.0028 + phase + seconds * 0.7) +
  Math.sin(x * 0.0009 - seconds * 0.3) * 0.7;
