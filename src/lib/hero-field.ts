/*
 * The homepage hero's drawing and simulation loop.
 *
 * The scene's geometry, its tuned constants and its pure helpers are in
 * hero-field-scene.ts, which carries the note explaining the projection every
 * length here is expressed against. This file owns the mutable per-box state
 * and the drawing.
 *
 * It knows about a CanvasRenderingContext2D and nothing else: no DOM, no
 * window, no Vue. HeroField.vue owns the canvases, the animation frame and the
 * pause control.
 */
import {
  BANDS,
  BOTTOM_DEPTH,
  CLUMP_COUNT,
  FIELD_OF_VIEW_FLOOR,
  FIELD_SEED,
  FOOT_Y,
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
  SPRING,
  breeze,
  random,
  stemPoint,
} from './hero-field-scene';
import { drawHare, hopFrame } from './hero-field-hare';
import type {
  HeroField,
  HeroPalette,
  Route,
  RoutePoint,
  Segment,
  Stem,
} from './hero-field-scene';

/*
 * The geometry, all of it derived in `layout` from the box the hero actually
 * occupies.
 */
interface Scene {
  readonly boxWidth: number;
  readonly boxHeight: number;
  readonly horizon: number;
  readonly projection: number;
  /** The projection relative to the comp's. Every length in the scene scales by it. */
  readonly world: number;
  /** The nearest distance the camera shows, which is what `BANDS.NEAR` starts at. */
  readonly view: number;
  readonly hareRoot: number;
  readonly hareScale: number;
}

type Band = (typeof BANDS)[keyof typeof BANDS];

interface FieldState {
  scene: Scene;
  stems: Stem[];
  route: Route;
  /*
   * A one-entry memo on the route lookup. `step` asks for the hare's position
   * twice and each drawn layer asks again, and without this every stem's
   * spring would rescan the segment list. It is keyed on the exact time value,
   * which is safe because a frame uses one.
   */
  cachedAt: number;
  cached: RoutePoint;
}

const STILL: RoutePoint = { x: 0, cycle: 0, sit: 0, hop: 0 };

const groundAt = (scene: Scene, z: number): number =>
  scene.horizon + scene.projection / z;

/* The two numbers the whole scene hangs off. See the module note and `FIELD_OF_VIEW_FLOOR`. */
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

/*
 * Clump centres. Three quarters of the growth is placed around one of these
 * and the rest scattered between them. A real field clumps, and at distance
 * the clumping is most of what you see, which is why evenly scattered stems
 * look wrong however carefully they are drawn.
 */
const clumpPlacer = (
  scene: Scene,
  rng: () => number,
  density: number,
  margin: number,
): ((spread: number) => number) => {
  const { boxWidth, world } = scene;
  const clumps: number[] = [];
  const clumpCount = Math.max(4, Math.round(CLUMP_COUNT * density));
  for (let i = 0; i < clumpCount; i += 1) {
    clumps.push(-margin + rng() * (boxWidth + margin * 2));
  }
  return (spread) => {
    if (rng() < 0.26) return -margin + rng() * (boxWidth + margin * 2);
    const centre = clumps[Math.floor(rng() * clumps.length)] ?? boxWidth / 2;
    /* Difference of two uniforms: a triangular spread, densest at the centre. */
    return centre + (rng() - rng()) * spread * world;
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
    tone: rng(),
    phase: rng() * Math.PI * 2,
    veil,
    lean: 0,
    leanRate: 0,
  };
};

/*
 * Density is measured against how wide the field is IN SCENE TERMS, not in
 * pixels. A narrow hero that has stepped its camera back is showing more field
 * than its width suggests, and needs the stems to match.
 */
const buildStems = (scene: Scene): Stem[] => {
  const { world, view } = scene;
  const density = scene.boxWidth / world / REFERENCE_WIDTH;
  const rng = random(FIELD_SEED);
  const clumped = clumpPlacer(scene, rng, density, 140 * world);
  const built: Stem[] = [];

  const band = (
    spec: Band,
    spread: number,
    veil: number,
    acrossFullWidth: boolean,
  ): void => {
    const count = Math.max(2, Math.round(spec.count * density));
    for (let i = 0; i < count; i += 1) {
      /*
       * Log-uniform in distance, so there are as many stems between 3 and 6
       * units out as between 6 and 12. Sampled uniformly instead, apparent
       * sizes pile up into a fuzz band at the horizon.
       */
      const near = spec.near || view;
      const z = near * Math.pow(spec.far / near, rng());
      const x = acrossFullWidth
        ? clumped(spread)
        : -140 * world + rng() * 245 * world;
      const height = spec.height[0] + rng() * spec.height[1];
      built.push(makeStem(scene, rng, z, x, height, veil));
    }
  };

  band(BANDS.FAR, 150, 1, true);
  band(BANDS.GRASS, 105, 1, true);
  band(BANDS.MIDDLE, 190, 1, true);
  band(BANDS.HARE, 190, 1, true);
  /*
   * The near frame is the exception to every rule above: five stems, always
   * at the left edge whatever the width, mostly cropped, held back to 72%
   * opacity. More of them, or at full opacity, compete with the name beside
   * them; scattered across the width they put blurred stalks over the type.
   */
  band(BANDS.NEAR, 0, NEAR_VEIL, false);

  /* Far to near, so within a layer they overlap correctly. */
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
    HOPS.find((candidate) => roll < candidate.odds) ?? HOPS[HOPS.length - 1];
  return {
    kind: 'hop',
    /* Long leaps take longer, which is what stops them looking like a skip. */
    duration: 0.34 + hop.distance / 420,
    x0: x,
    x1: x + hop.distance * world,
    hop: hop.height * world,
    start: 0,
  };
};

/*
 * Measured in pixels across the box, with hops that scale with the projection,
 * so a smaller hare takes smaller bounds rather than clearing half the screen
 * in one.
 */
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
        /* Sits down over the first fraction of the rest, then holds. */
        sit: Math.max(
          0,
          Math.min(1, Math.sin(Math.min(1, f * 1.3) * Math.PI) * 1.7),
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
  /* About the hare's own body width, so it reads as touching rather than as a gust. */
  const reach = (58 + stem.size * 110) * world;
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

/* ---------------------------------------------------------------- *
 * One stem
 * ---------------------------------------------------------------- */

const budTone = (palette: HeroPalette, tone: number): string => {
  if (tone > 0.78) return palette.muted;
  if (tone > 0.5) return palette.subtle;
  return palette.border;
};

/* Bud count and spacing along the stem, by height in reference units. */
const budLayout = (tall: number): { count: number; spacing: number } => {
  if (tall > 200) return { count: 5, spacing: 0.11 };
  if (tall > 92) return { count: 3, spacing: 0.16 };
  if (tall > 42) return { count: 2, spacing: 0.19 };
  return { count: 0, spacing: 0.19 };
};

const drawStalk = (
  ctx: CanvasRenderingContext2D,
  stem: Stem,
  lean: number,
): void => {
  ctx.lineCap = 'round';
  ctx.lineWidth = Math.max(0.55, 0.55 + stem.size * 3.1);
  ctx.beginPath();
  ctx.moveTo(stem.x, stem.root);
  ctx.bezierCurveTo(
    stem.x + lean * 0.18,
    stem.root - stem.height * 0.45,
    stem.x + lean * 0.62,
    stem.root - stem.height * 0.8,
    stem.x + lean,
    stem.root - stem.height,
  );
  ctx.stroke();
};

const drawBuds = (
  ctx: CanvasRenderingContext2D,
  stem: Stem,
  lean: number,
  bud: number,
  seconds: number,
  world: number,
): void => {
  const { count, spacing } = budLayout(stem.height / world);
  /* The buds nod slightly behind the stem, which is what stops them looking welded on. */
  const nod =
    Math.sin(stem.x * 0.0028 + stem.phase + seconds * 0.7 - 0.5) * 0.16;

  for (let i = 0; i < count; i += 1) {
    const [bx, by] = stemPoint(
      stem.x,
      stem.root,
      stem.height,
      lean,
      0.55 + i * spacing,
    );
    const side = i % 2 ? 1 : -1;
    ctx.save();
    ctx.translate(bx + side * 3 * bud, by);
    ctx.rotate(side * 0.3 + nod);
    ctx.beginPath();
    ctx.ellipse(0, 0, 2.4 * bud, 4.2 * bud, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
};

const drawHead = (
  ctx: CanvasRenderingContext2D,
  stem: Stem,
  lean: number,
  bud: number,
): void => {
  const [tx, ty] = stemPoint(stem.x, stem.root, stem.height, lean, 1);
  ctx.beginPath();
  ctx.ellipse(
    tx,
    ty - 4 * bud,
    Math.max(0.75, 2.7 * bud),
    Math.max(1.3, 5.2 * bud),
    0,
    0,
    Math.PI * 2,
  );
  ctx.stroke();
};

/*
 * Detail steps DOWN with distance rather than switching off at a threshold,
 * and every step keeps a minimum drawn size. Switching off gives the distance
 * a field of bare scratches; keeping full detail stacks sub-pixel ellipses
 * into grey mush.
 */
const drawStem = (
  ctx: CanvasRenderingContext2D,
  palette: HeroPalette,
  world: number,
  stem: Stem,
  lean: number,
  seconds: number,
): void => {
  const alpha = (0.09 + Math.sqrt(stem.scale) * 0.5) * stem.veil;
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = palette.border;
  drawStalk(ctx, stem, lean);

  /* Grass at the horizon. A mark, and nothing would survive being drawn on it. */
  if (stem.height < 13 * world) return;

  const bud = Math.max(0.36, stem.size * 2.3);
  ctx.globalAlpha = Math.min(0.82, alpha + 0.16);
  ctx.strokeStyle = budTone(palette, stem.tone);
  ctx.lineWidth = Math.max(0.55, 0.4 + stem.size * 1.7);
  drawBuds(ctx, stem, lean, bud, seconds, world);
  drawHead(ctx, stem, lean, bud);
};

/* ---------------------------------------------------------------- *
 * Atmosphere
 * ---------------------------------------------------------------- */

/*
 * A band of light across the horizon, painted between the far stems and the
 * near ones so it veils the distance rather than the whole scene. It stands in
 * for the horizon, which is never drawn.
 */
const drawVeil = (ctx: CanvasRenderingContext2D, scene: Scene): void => {
  const top = scene.horizon - 64 * scene.world;
  const depth = 260 * scene.world;
  const gradient = ctx.createLinearGradient(0, top, 0, top + depth);
  gradient.addColorStop(0, 'rgba(90, 135, 168, 0)');
  gradient.addColorStop(0.34, 'rgba(90, 135, 168, 0.085)');
  gradient.addColorStop(1, 'rgba(90, 135, 168, 0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, top, scene.boxWidth, depth);
};

/*
 * Weight under the near ground. On the back layer deliberately: on the front
 * it darkens the hare, the one thing in the scene that must not lose contrast.
 */
const drawFloor = (ctx: CanvasRenderingContext2D, scene: Scene): void => {
  const { boxWidth, boxHeight } = scene;
  const top = boxHeight - 230 * scene.world;
  const gradient = ctx.createLinearGradient(0, top, 0, boxHeight);
  gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
  gradient.addColorStop(1, 'rgba(0, 0, 0, 0.34)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, top, boxWidth, boxHeight - top);
};

/* The shadow shrinks as it rises, which is what sells the height. */
const drawHareShadow = (
  ctx: CanvasRenderingContext2D,
  palette: HeroPalette,
  scene: Scene,
  x: number,
  air: number,
): void => {
  ctx.globalAlpha = 0.2 * (1 - air);
  ctx.fillStyle = palette.border;
  ctx.beginPath();
  ctx.ellipse(
    x,
    scene.hareRoot + 2,
    30 * scene.hareScale,
    4.2 * scene.hareScale,
    0,
    0,
    Math.PI * 2,
  );
  ctx.fill();
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
      breeze(stem.x, stem.phase, seconds) * (3 + stem.size * 30) * scene.world;
    drawStem(ctx, palette, scene.world, stem, wind + stem.lean, seconds);
  }
  ctx.globalAlpha = 1;
};

const stepSprings = (
  state: FieldState,
  seconds: number,
  delta: number,
): void => {
  const { scene, stems, route } = state;
  const here = routeAt(state, seconds);
  /*
   * The hare's speed by difference rather than from the segment, so a rest
   * reads as zero and the impulse follows the actual motion. The guard catches
   * the route wrapping from one edge to the other, which would otherwise
   * register as one shove across the whole field.
   */
  let speed = (here.x - routePoint(route, seconds - 0.05).x) / 0.05;
  if (Math.abs(speed) > SPEED_LIMIT_RATIO * scene.projection) speed = 0;
  const limit = LEAN_LIMIT_RATIO * scene.projection;

  for (const stem of stems) {
    settle(stem, hareForce(stem, here.x, speed, scene.world), delta, limit);
  }
};

const drawBack = (
  ctx: CanvasRenderingContext2D,
  palette: HeroPalette,
  state: FieldState,
  seconds: number,
): void => {
  paintWhere(ctx, palette, state, seconds, (z) => z > 7);
  drawVeil(ctx, state.scene);
  paintWhere(ctx, palette, state, seconds, (z) => z <= 7 && z >= HARE_DEPTH);
  drawFloor(ctx, state.scene);
  ctx.globalAlpha = 1;
};

const drawMid = (
  ctx: CanvasRenderingContext2D,
  palette: HeroPalette,
  state: FieldState,
  seconds: number,
): void => {
  const here = routeAt(state, seconds);
  const frame = hopFrame(here.cycle, here.sit, seconds);
  const { hareRoot, hareScale } = state.scene;

  drawHareShadow(ctx, palette, state.scene, here.x, frame.air);
  drawHare(
    ctx,
    here.x,
    hareRoot - FOOT_Y * hareScale - frame.air * here.hop * hareScale,
    hareScale,
    frame,
    palette,
  );

  /* Everything between the hare and you, but still in focus. */
  paintWhere(
    ctx,
    palette,
    state,
    seconds,
    (z) => z < HARE_DEPTH && z >= FRONT_DEPTH,
  );
};

export const createHeroField = (palette: HeroPalette): HeroField => {
  const state: FieldState = {
    /* The reference box, so a draw before the first layout cannot divide by zero. */
    scene: sceneFor(REFERENCE_WIDTH, REFERENCE_HEIGHT),
    stems: [],
    route: { segments: [], total: 1 },
    cachedAt: Number.NaN,
    cached: STILL,
  };

  return {
    layout(width: number, height: number): void {
      state.scene = sceneFor(width, height);
      state.stems = buildStems(state.scene);
      state.route = buildRoute(state.scene);
      state.cachedAt = Number.NaN;
    },
    step: (seconds, delta) => stepSprings(state, seconds, delta),
    back: (ctx, seconds) => drawBack(ctx, palette, state, seconds),
    mid: (ctx, seconds) => drawMid(ctx, palette, state, seconds),
    nearBlur: () => NEAR_BLUR * state.scene.world,
    near: (ctx, seconds) =>
      paintWhere(ctx, palette, state, seconds, (z) => z < FRONT_DEPTH),
  };
};
