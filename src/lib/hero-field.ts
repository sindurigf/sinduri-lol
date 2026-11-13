/*
 * Mutable per-box state and drawing. Constants and the projection model are in
 * hero-field-scene.ts; src/scripts/hero-field.ts owns the canvases and the frame loop.
 */
import { itemAt } from './defined';
import {
  BANDS,
  BOTTOM_DEPTH,
  BUD_ALPHA,
  BUD_MIN_HEIGHT,
  BUD_NOD,
  BUD_SIZE,
  BUD_START,
  BUD_TIERS,
  FILL_OUTLINE,
  CLUMP_COUNT,
  CLUMP_SPREAD,
  HOP_BASE_SECONDS,
  HOP_SPEED,
  NEAR_BAND_LEFT,
  NEAR_BAND_WIDTH,
  SPEED_SAMPLE_SECONDS,
  STEM_CURVE,
  STRAY_ODDS,
  SWAY,
  WIND_FORCE,
  WIND_WAVE,
  breezeWave,
  DENSITY_CAP,
  FIELD_OF_VIEW_FLOOR,
  EXTRA_SEED,
  EXTRA_STEMS,
  FIELD_SEED,
  FRONT_DEPTH,
  GROUND_SPAN,
  HARE_DEPTH,
  HARE_UNIT,
  HOPS,
  LEAN_LIMIT_RATIO,
  NEAR_BLUR,
  NEAR_VEIL,
  REACH_AHEAD,
  REACH_BEHIND,
  REACH_DEPTH,
  REFERENCE_ASPECT,
  REFERENCE_HEIGHT,
  REFERENCE_PROJECTION,
  REFERENCE_WIDTH,
  REST_LONG,
  REST_LONG_ODDS,
  REST_MIN_HOPS,
  REST_ODDS,
  REST_SHORT,
  ROUTE_MARGIN,
  ROUTE_SEED,
  SPEED_LIMIT_RATIO,
  SIT,
  SPRING,
  STALK_WIDTH,
  STALK_WIDTH_SHARE,
  STEM_ALPHA,
  REACH,
  breeze,
  random,
  stemPoint,
} from './hero-field-scene';
import { ATLAS_SIZE } from './rabbit-atlas';
import {
  atlasDensity,
  drawRabbit,
  rabbitAir,
  rabbitPose,
} from './hero-field-rabbit';
import type {
  HeroField,
  HeroPalette,
  Route,
  RoutePoint,
  Segment,
  Stem,
} from './hero-field-scene';

interface Scene {
  readonly boxWidth: number;
  readonly boxHeight: number;
  readonly horizon: number;
  readonly projection: number;
  /** Projection relative to the comp's; every length scales by it. */
  readonly world: number;
  /** Nearest visible depth; where `BANDS.NEAR` starts. */
  readonly view: number;
  readonly hareRoot: number;
  readonly hareScale: number;
}

type Band = (typeof BANDS)[keyof typeof BANDS];

interface FieldState {
  scene: Scene;
  stems: Stem[];
  route: Route;
  /* One-entry memo of `routePoint`, keyed on the frame's exact time. */
  cachedAt: number;
  cached: RoutePoint;
  /* Blurred hare shadows by air step, for the scene and pixel ratio they were drawn at. */
  shadows: Map<number, ShadowSprite>;
  shadowRatio: number;
}

interface ShadowSprite {
  readonly canvas: HTMLCanvasElement;
  /** CSS pixels, centered on the shadow. */
  readonly width: number;
  readonly height: number;
}

const STILL: RoutePoint = { x: 0, cycle: 0, sit: 0, hop: 0 };

const groundAt = (scene: Scene, z: number): number =>
  scene.horizon + scene.projection / z;

const sceneFor = (width: number, height: number): Scene => {
  const boxWidth = Math.max(1, width);
  const boxHeight = Math.max(1, height);
  const aspect = Math.min(1, boxWidth / boxHeight / REFERENCE_ASPECT);
  const view = Math.max(FIELD_OF_VIEW_FLOOR, aspect);
  const projection = GROUND_SPAN * boxHeight * view;
  const horizon = boxHeight - projection / BOTTOM_DEPTH;
  return {
    boxWidth,
    boxHeight,
    horizon,
    projection,
    world: projection / REFERENCE_PROJECTION,
    view,
    hareRoot: horizon + projection / HARE_DEPTH,
    hareScale: (projection / HARE_DEPTH) * HARE_UNIT,
  };
};

const clumpCenters = (
  { boxWidth }: Scene,
  rng: () => number,
  density: number,
  margin: number,
): number[] =>
  Array.from(
    { length: Math.max(4, Math.round(CLUMP_COUNT * density)) },
    () => -margin + rng() * (boxWidth + margin * 2),
  );

/* About three quarters of stems cluster on clump centers; the rest scatter. */
const clumpPlacer = (
  { boxWidth, world }: Scene,
  clumps: readonly number[],
  rng: () => number,
  margin: number,
): ((spread: number) => number) => {
  return (spread) => {
    if (rng() < STRAY_ODDS) return -margin + rng() * (boxWidth + margin * 2);
    const center = clumps[Math.floor(rng() * clumps.length)] ?? boxWidth / 2;
    /* Difference of two uniforms: triangular, densest at the center. */
    return center + (rng() - rng()) * spread * world;
  };
};

const makeStem = (
  scene: Scene,
  rng: () => number,
  z: number,
  x: number,
  heightRatio: number,
  veil: number,
): Stem => {
  const root = groundAt(scene, z);
  return {
    z,
    scale: 1 / z,
    size: (root - scene.horizon) / REFERENCE_PROJECTION,
    x,
    root,
    height: heightRatio * (root - scene.horizon),
    phase: rng() * Math.PI * 2,
    veil,
    lean: 0,
    leanRate: 0,
  };
};

/* Density is per scene width, not pixels: a stepped-back camera shows more. */
const buildStems = (scene: Scene): Stem[] => {
  const { world, view } = scene;
  const density = Math.min(
    DENSITY_CAP,
    scene.boxWidth / world / REFERENCE_WIDTH,
  );
  const margin = CLUMP_SPREAD * world;
  const rng = random(FIELD_SEED);
  const clumps = clumpCenters(scene, rng, density, margin);
  const built: Stem[] = [];

  const sow = (next: () => number, share: number, nearTip = -Infinity) => {
    const clumped = clumpPlacer(scene, clumps, next, margin);
    const band = (spec: Band, veil: number, acrossFullWidth: boolean): void => {
      const count = Math.round(
        Math.max(2, Math.round(spec.count * density)) * share,
      );
      for (let i = 0; i < count; i += 1) {
        /* Log-uniform in distance; uniform piles stems up at the horizon. */
        const near = spec.near || view;
        const z = near * Math.pow(spec.far / near, next());
        const x = acrossFullWidth
          ? clumped(spec.spread)
          : NEAR_BAND_LEFT * world + next() * NEAR_BAND_WIDTH * world;
        const height = spec.height[0] + next() * spec.height[1];
        const stem = makeStem(scene, next, z, x, height, veil);
        /* Never above `nearTip`, so a later sowing cannot reach the name. */
        const rise = Math.min(stem.height, stem.root - nearTip);
        built.push(rise < stem.height ? { ...stem, height: rise } : stem);
      }
    };

    band(BANDS.FAR, 1, true);
    band(BANDS.GRASS, 1, true);
    band(BANDS.MIDDLE, 1, true);
    band(BANDS.HARE, 1, true);
    /* Near stems stay at the left edge so they never blur over type; the veil fades only their light bud fills. */
    band(BANDS.NEAR, NEAR_VEIL, false);
  };

  sow(rng, 1);
  const nearTip = Math.min(
    ...built
      .filter((stem) => stem.z < BANDS.NEAR.far)
      .map((s) => s.root - s.height),
  );
  /* Its own seed, so the stems above keep their places. */
  sow(random(EXTRA_SEED), EXTRA_STEMS, nearTip);

  return built.sort((a, b) => b.z - a.z);
};

const restSegment = (x: number, rng: () => number): Segment => ({
  kind: 'rest',
  duration: rng() < REST_LONG_ODDS ? REST_LONG : REST_SHORT,
  x0: x,
  x1: x,
  hop: 0,
  start: 0,
});

const hopSegment = (x: number, rng: () => number, world: number): Segment => {
  const roll = rng();
  const hop =
    HOPS.find((candidate) => roll < candidate.odds) ??
    itemAt(HOPS, HOPS.length - 1);
  return {
    kind: 'hop',
    duration: HOP_BASE_SECONDS + hop.distance / HOP_SPEED,
    x0: x,
    x1: x + hop.distance * world,
    hop: hop.height * world,
    start: 0,
  };
};

/* Pixels across the box; hop length scales with the projection. */
const buildRoute = ({ boxWidth, world }: Scene): Route => {
  const rng = random(ROUTE_SEED);
  const segments: Segment[] = [];
  const edge = ROUTE_MARGIN * world;
  let x = -edge;
  let sinceRest = 0;

  while (x < boxWidth + edge) {
    if (sinceRest > REST_MIN_HOPS - 1 && rng() < REST_ODDS) {
      segments.push(restSegment(x, rng));
      sinceRest = 0;
    } else {
      const segment = hopSegment(x, rng, world);
      segments.push(segment);
      x = segment.x1;
      sinceRest += 1;
    }
  }

  let total = 0;
  for (const segment of segments) {
    segment.start = total;
    total += segment.duration;
  }
  return { segments, total: Math.max(total, 0.001) };
};

const routePoint = (route: Route, seconds: number): RoutePoint => {
  const local = ((seconds % route.total) + route.total) % route.total;
  for (const segment of route.segments) {
    if (local >= segment.start + segment.duration) continue;
    const f = (local - segment.start) / segment.duration;
    if (segment.kind === 'rest') {
      return {
        x: segment.x0,
        cycle: 0,
        hop: 0,
        sit: Math.max(
          0,
          Math.min(1, Math.sin(Math.min(1, f * SIT.rate) * Math.PI) * SIT.gain),
        ),
      };
    }
    return {
      x: segment.x0 + (segment.x1 - segment.x0) * f,
      cycle: f,
      sit: 0,
      hop: segment.hop,
    };
  }
  return STILL;
};

const hareForce = (
  stem: Stem,
  hareX: number,
  speed: number,
  world: number,
): number => {
  const depth = Math.abs(stem.z - HARE_DEPTH) / HARE_DEPTH;
  if (depth >= REACH_DEPTH) return 0;
  const reach = (REACH.base + stem.size * REACH.bySize) * world;
  const gap = stem.x - hareX;
  if (Math.abs(gap) >= reach) return 0;
  const proximity = 1 - Math.abs(gap) / reach;
  const side = gap * speed < 0 ? REACH_BEHIND : REACH_AHEAD;
  return (
    proximity *
    proximity *
    (1 - depth / REACH_DEPTH) *
    speed *
    SPRING.impulse *
    side
  );
};

const settle = (
  stem: Stem,
  force: number,
  delta: number,
  limit: number,
): void => {
  stem.leanRate +=
    (-SPRING.stiffness * stem.lean - SPRING.damping * stem.leanRate + force) *
    delta;
  stem.lean += stem.leanRate * delta;
  if (Math.abs(stem.lean) > limit) {
    stem.lean = Math.sign(stem.lean) * limit;
    stem.leanRate = 0;
  }
};

/* Full strength in both modes: a faded stalk falls under 7:1 on its ground. */
const strokeStalk = (
  ctx: CanvasRenderingContext2D,
  palette: HeroPalette,
): void => {
  ctx.strokeStyle = palette.stalk;
  ctx.globalAlpha = 1;
  ctx.lineWidth = Math.max(STALK_WIDTH.min, ctx.lineWidth * STALK_WIDTH_SHARE);
  ctx.stroke();
};

/* Only a light bud's fill fades with distance: the ground goes under it and its outline stays opaque. */
const fillBud = (
  ctx: CanvasRenderingContext2D,
  palette: HeroPalette,
  alpha: number,
): void => {
  ctx.globalAlpha = 1;
  if (!palette.fill) {
    ctx.fillStyle = palette.stalk;
    ctx.fill();
    return;
  }
  ctx.fillStyle = palette.background;
  ctx.fill();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = palette.fill;
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.strokeStyle = palette.stalk;
  ctx.lineWidth = FILL_OUTLINE;
  ctx.stroke();
};

const budLayout = (tall: number): { count: number; spacing: number } =>
  BUD_TIERS.find(({ above }) => tall > above) ?? { count: 0, spacing: 0 };

const traceStalk = (
  ctx: CanvasRenderingContext2D,
  stem: Stem,
  lean: number,
): void => {
  ctx.lineCap = 'round';
  ctx.lineWidth = STALK_WIDTH.min + stem.size * STALK_WIDTH.bySize;
  ctx.beginPath();
  ctx.moveTo(stem.x, stem.root);
  ctx.bezierCurveTo(
    stem.x + lean * STEM_CURVE.lean1,
    stem.root - stem.height * STEM_CURVE.rise1,
    stem.x + lean * STEM_CURVE.lean2,
    stem.root - stem.height * STEM_CURVE.rise2,
    stem.x + lean,
    stem.root - stem.height,
  );
};

/** In bud sizes: set off the stalk to alternating sides, radii, and tilt in radians. */
const BUD_SHAPE = { offset: 3, rx: 2.4, ry: 4.2, tilt: 0.3 } as const;
/** In bud sizes above the stem tip; `minRx` and `minRy` are CSS pixels. */
const HEAD_SHAPE = {
  rise: 4,
  rx: 2.7,
  ry: 5.2,
  minRx: 0.75,
  minRy: 1.3,
} as const;

/* Buds fill, never just stroke, or stalks show through them as wire loops. */
const drawBuds = (
  ctx: CanvasRenderingContext2D,
  stem: Stem,
  lean: number,
  bud: number,
  seconds: number,
  world: number,
  fill: () => void,
): void => {
  const { count, spacing } = budLayout(stem.height / world);
  const nod =
    Math.sin(breezeWave(stem.x, stem.phase, seconds) - BUD_NOD.lag) *
    BUD_NOD.amplitude;

  for (let i = 0; i < count; i += 1) {
    const [bx, by] = stemPoint(
      stem.x,
      stem.root,
      stem.height,
      lean,
      BUD_START + i * spacing,
    );
    const side = i % 2 ? 1 : -1;
    ctx.beginPath();
    ctx.ellipse(
      bx + side * BUD_SHAPE.offset * bud,
      by,
      BUD_SHAPE.rx * bud,
      BUD_SHAPE.ry * bud,
      side * BUD_SHAPE.tilt + nod,
      0,
      Math.PI * 2,
    );
    fill();
  }
};

const drawHead = (
  ctx: CanvasRenderingContext2D,
  stem: Stem,
  lean: number,
  bud: number,
  fill: () => void,
): void => {
  const [tx, ty] = stemPoint(stem.x, stem.root, stem.height, lean, 1);
  ctx.beginPath();
  ctx.ellipse(
    tx,
    ty - HEAD_SHAPE.rise * bud,
    Math.max(HEAD_SHAPE.minRx, HEAD_SHAPE.rx * bud),
    Math.max(HEAD_SHAPE.minRy, HEAD_SHAPE.ry * bud),
    0,
    0,
    Math.PI * 2,
  );
  fill();
};

/* Detail steps down with distance, with a minimum drawn size at each step. */
const drawStem = (
  ctx: CanvasRenderingContext2D,
  palette: HeroPalette,
  world: number,
  stem: Stem,
  lean: number,
  seconds: number,
): void => {
  const alpha =
    (STEM_ALPHA.base + Math.sqrt(stem.scale) * STEM_ALPHA.byScale) * stem.veil;
  traceStalk(ctx, stem, lean);
  strokeStalk(ctx, palette);

  if (stem.height < BUD_MIN_HEIGHT * world) return;

  const bud = Math.max(BUD_SIZE.min, stem.size * BUD_SIZE.bySize);
  const budAlpha = Math.min(BUD_ALPHA.max, alpha + BUD_ALPHA.lift);
  const fill = (): void => fillBud(ctx, palette, budAlpha);
  drawBuds(ctx, stem, lean, bud, seconds, world, fill);
  drawHead(ctx, stem, lean, bud, fill);
};

/*
 * Shrinks, fades and blurs as the hare rises; the alpha floor keeps a contact
 * point at the top of a hop.
 */
const SHADOW_SHRINK = 0.45;
const SHADOW_ALPHA_FLOOR = 0.08;
const SHADOW_ALPHA_RANGE = 0.14;
const SHADOW_BLUR = 3.2;
/** In drawing units: below the feet, then the radii on the ground. */
const SHADOW_SHAPE = { drop: 1.2, rx: 30, ry: 3.6 } as const;

/** Air levels the shadow is blurred at, each once per layout. */
const SHADOW_STEPS = 32;
/** A Gaussian blur reaches about three times its radius. */
const BLUR_REACH = 3;

/* `ctx.filter` on every frame holds a 4x-throttled field under its frame cap; a cached sprite does not. */
const shadowSprite = (
  state: FieldState,
  palette: HeroPalette,
  ratio: number,
  step: number,
): ShadowSprite => {
  if (state.shadowRatio !== ratio) {
    state.shadows.clear();
    state.shadowRatio = ratio;
  }
  const cached = state.shadows.get(step);
  if (cached) return cached;

  const { hareScale } = state.scene;
  const air = step / SHADOW_STEPS;
  const shrink = 1 - air * SHADOW_SHRINK;
  const rx = SHADOW_SHAPE.rx * hareScale * shrink;
  const ry = SHADOW_SHAPE.ry * hareScale * shrink;
  const blur = air * SHADOW_BLUR * hareScale;
  const pad = Math.ceil(blur * BLUR_REACH) + 1;
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil((rx + pad) * 2 * ratio);
  canvas.height = Math.ceil((ry + pad) * 2 * ratio);
  const sprite = {
    canvas,
    width: canvas.width / ratio,
    height: canvas.height / ratio,
  };
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.filter = `blur(${blur.toFixed(2)}px)`;
    ctx.fillStyle = palette.shadow;
    ctx.beginPath();
    ctx.ellipse(sprite.width / 2, sprite.height / 2, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  state.shadows.set(step, sprite);
  return sprite;
};

/* On whole device pixels, so a sharp shadow at rest is not resampled soft. */
const snap = (value: number, ratio: number): number =>
  Math.round(value * ratio) / ratio;

const drawHareShadow = (
  ctx: CanvasRenderingContext2D,
  palette: HeroPalette,
  state: FieldState,
  x: number,
  air: number,
): void => {
  const { hareRoot, hareScale } = state.scene;
  const ratio = ctx.getTransform().a;
  const sprite = shadowSprite(
    state,
    palette,
    ratio,
    Math.round(air * SHADOW_STEPS),
  );
  ctx.globalAlpha = SHADOW_ALPHA_FLOOR + SHADOW_ALPHA_RANGE * (1 - air);
  ctx.drawImage(
    sprite.canvas,
    snap(x - sprite.width / 2, ratio),
    snap(hareRoot + SHADOW_SHAPE.drop * hareScale - sprite.height / 2, ratio),
    sprite.width,
    sprite.height,
  );
  ctx.globalAlpha = 1;
};

const routeAt = (state: FieldState, seconds: number): RoutePoint => {
  if (seconds !== state.cachedAt) {
    state.cachedAt = seconds;
    state.cached = routePoint(state.route, seconds);
  }
  return state.cached;
};

const paintWhere = (
  ctx: CanvasRenderingContext2D,
  palette: HeroPalette,
  { scene, stems }: FieldState,
  seconds: number,
  inLayer: (z: number) => boolean,
): void => {
  for (const stem of stems) {
    if (!inLayer(stem.z)) continue;
    const wind =
      breeze(stem.x, stem.phase, seconds) *
      (SWAY.base + stem.size * SWAY.bySize) *
      scene.world;
    drawStem(ctx, palette, scene.world, stem, wind + stem.lean, seconds);
  }
  ctx.globalAlpha = 1;
};

const windForce = (stem: Stem, seconds: number, world: number): number =>
  Math.sin(
    stem.x * WIND_WAVE.rate +
      stem.phase * WIND_WAVE.phaseShare +
      seconds * WIND_WAVE.speed,
  ) *
  WIND_FORCE *
  (WIND_WAVE.floor + stem.size) *
  world;

const stepSprings = (
  state: FieldState,
  seconds: number,
  delta: number,
): void => {
  const { scene, stems, route } = state;
  const here = routeAt(state, seconds);
  /* By difference, so a rest reads as zero; the guard drops the edge wrap. */
  let speed =
    (here.x - routePoint(route, seconds - SPEED_SAMPLE_SECONDS).x) /
    SPEED_SAMPLE_SECONDS;
  if (Math.abs(speed) > SPEED_LIMIT_RATIO * scene.projection) speed = 0;
  const limit = LEAN_LIMIT_RATIO * scene.projection;

  for (const stem of stems) {
    settle(
      stem,
      hareForce(stem, here.x, speed, scene.world) +
        windForce(stem, seconds, scene.world),
      delta,
      limit,
    );
  }
};

const drawBack = (
  ctx: CanvasRenderingContext2D,
  palette: HeroPalette,
  state: FieldState,
  seconds: number,
): void => {
  paintWhere(ctx, palette, state, seconds, (z) => z >= HARE_DEPTH);
};

/* Rasterising takes tens of ms on a phone: only a size change past this share redraws it. */
const DENSITY_STEP = 0.02;
let rasterised: {
  atlas: CanvasImageSource;
  density: number;
  canvas: HTMLCanvasElement;
} | null = null;

/** The vector atlas rasterised at `density`, once per size, so the rabbit is drawn at its own resolution. */
const atlasAt = (
  atlas: CanvasImageSource,
  density: number,
): { canvas: HTMLCanvasElement; density: number } => {
  if (
    rasterised?.atlas === atlas &&
    Math.abs(rasterised.density / density - 1) < DENSITY_STEP
  )
    return rasterised;
  const canvas = rasterised?.canvas ?? document.createElement('canvas');
  canvas.width = Math.ceil(ATLAS_SIZE.w * density);
  canvas.height = Math.ceil(ATLAS_SIZE.h * density);
  canvas
    .getContext('2d')
    ?.drawImage(atlas, 0, 0, ATLAS_SIZE.w * density, ATLAS_SIZE.h * density);
  rasterised = { atlas, density, canvas };
  return rasterised;
};

const drawMid = (
  ctx: CanvasRenderingContext2D,
  palette: HeroPalette,
  atlas: CanvasImageSource | null,
  state: FieldState,
  seconds: number,
): void => {
  const here = routeAt(state, seconds);
  const air = rabbitAir(here);
  const { hareRoot, hareScale } = state.scene;

  if (atlas) {
    drawHareShadow(ctx, palette, state, here.x, air);
    const sheet = atlasAt(atlas, atlasDensity(hareScale, ctx.getTransform().a));
    drawRabbit(
      ctx,
      sheet.canvas,
      here.x,
      hareRoot,
      hareScale,
      rabbitPose(here, seconds),
      air * here.hop,
      sheet.density,
    );
  }

  paintWhere(
    ctx,
    palette,
    state,
    seconds,
    (z) => z < HARE_DEPTH && z >= FRONT_DEPTH,
  );
};

/* `atlas` is the decoded src/assets/hero-rabbit.svg; null draws the field without the rabbit. */
export const createHeroField = (
  palette: HeroPalette,
  atlas: CanvasImageSource | null,
): HeroField => {
  const state: FieldState = {
    /* A draw before the first layout must not divide by zero. */
    scene: sceneFor(REFERENCE_WIDTH, REFERENCE_HEIGHT),
    stems: [],
    route: { segments: [], total: 1 },
    cachedAt: Number.NaN,
    cached: STILL,
    shadows: new Map(),
    shadowRatio: 0,
  };

  return {
    layout(width: number, height: number): void {
      state.scene = sceneFor(width, height);
      state.stems = buildStems(state.scene);
      state.route = buildRoute(state.scene);
      state.cachedAt = Number.NaN;
      state.shadows.clear();
    },
    step: (seconds, delta) => stepSprings(state, seconds, delta),
    back: (ctx, seconds) => drawBack(ctx, palette, state, seconds),
    mid: (ctx, seconds) => drawMid(ctx, palette, atlas, state, seconds),
    nearBlur: () => NEAR_BLUR * state.scene.world,
    near: (ctx, seconds) =>
      paintWhere(ctx, palette, state, seconds, (z) => z < FRONT_DEPTH),
  };
};
