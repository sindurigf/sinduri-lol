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
  HORIZON_RATIO,
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

/* ------------------------------------------------------------------ */

export const createHeroField = (palette: HeroPalette): HeroField => {
  let stems: Stem[] = [];
  let route: Route = { segments: [], total: 1 };

  /*
   * The geometry, all of it derived in `layout` from the box the hero actually
   * occupies. Seeded with the reference box so a draw before the first layout
   * cannot divide by zero.
   */
  let boxWidth = REFERENCE_WIDTH;
  let boxHeight = REFERENCE_HEIGHT;
  let horizon = HORIZON_RATIO * REFERENCE_HEIGHT;
  let projection = REFERENCE_PROJECTION;
  /** The projection relative to the comp's. Every length in the scene scales by it. */
  let world = 1;
  let hareRoot = horizon + projection / HARE_DEPTH;
  let hareScale = (projection / HARE_DEPTH) * HARE_UNIT;

  const groundAt = (z: number): number => horizon + projection / z;

  /*
   * A one-entry memo on the route lookup. `step` asks for the hare's position
   * twice and each drawn layer asks again, and without this every stem's spring
   * would rescan the segment list. It is keyed on the exact time value, which is
   * safe because a frame uses one.
   */
  let cachedAt = Number.NaN;
  let cached: RoutePoint = { x: 0, cycle: 0, sit: 0, hop: 0 };

  const routeCalc = (seconds: number): RoutePoint => {
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
    return { x: 0, cycle: 0, sit: 0, hop: 0 };
  };

  const routeAt = (seconds: number): RoutePoint => {
    if (seconds === cachedAt) return cached;
    cachedAt = seconds;
    cached = routeCalc(seconds);
    return cached;
  };

  /* ---------------------------------------------------------------- *
   * One stem
   * ---------------------------------------------------------------- */

  /*
   * Detail steps DOWN with distance rather than switching off at a threshold,
   * and every step keeps a minimum drawn size. Switching off gives the
   * distance a field of bare scratches; keeping full detail stacks sub-pixel
   * ellipses into grey mush.
   */
  const drawStem = (
    ctx: CanvasRenderingContext2D,
    stem: Stem,
    lean: number,
    seconds: number,
  ): void => {
    const budScale = stem.size * 2.3;
    const alpha = (0.09 + Math.sqrt(stem.scale) * 0.5) * stem.veil;

    ctx.globalAlpha = alpha;
    ctx.strokeStyle = palette.border;
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

    /* Grass at the horizon. A mark, and nothing would survive being drawn on it. */
    if (stem.height < 13 * world) return;

    const tone =
      stem.tone > 0.78
        ? palette.muted
        : stem.tone > 0.5
          ? palette.subtle
          : palette.border;
    const bud = Math.max(0.36, budScale);
    ctx.globalAlpha = Math.min(0.82, alpha + 0.16);
    ctx.strokeStyle = tone;
    ctx.lineWidth = Math.max(0.55, 0.4 + stem.size * 1.7);

    const tall = stem.height / world;
    const buds = tall > 200 ? 5 : tall > 92 ? 3 : tall > 42 ? 2 : 0;
    const spacing = buds === 5 ? 0.11 : buds === 3 ? 0.16 : 0.19;
    /* The buds nod slightly behind the stem, which is what stops them looking welded on. */
    const nod =
      Math.sin(stem.x * 0.0028 + stem.phase + seconds * 0.7 - 0.5) * 0.16;

    for (let i = 0; i < buds; i += 1) {
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

  const paint = (
    ctx: CanvasRenderingContext2D,
    stem: Stem,
    seconds: number,
  ): void => {
    const wind =
      breeze(stem.x, stem.phase, seconds) * (3 + stem.size * 30) * world;
    drawStem(ctx, stem, wind + stem.lean, seconds);
  };

  /* ---------------------------------------------------------------- *
   * Atmosphere
   * ---------------------------------------------------------------- */

  /*
   * A band of light across the horizon, painted between the far stems and the
   * near ones so it veils the distance rather than the whole scene. It stands
   * in for the horizon, which is never drawn.
   */
  const veil = (ctx: CanvasRenderingContext2D): void => {
    const top = horizon - 64 * world;
    const depth = 260 * world;
    const gradient = ctx.createLinearGradient(0, top, 0, top + depth);
    gradient.addColorStop(0, 'rgba(90, 135, 168, 0)');
    gradient.addColorStop(0.34, 'rgba(90, 135, 168, 0.085)');
    gradient.addColorStop(1, 'rgba(90, 135, 168, 0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, top, boxWidth, depth);
  };

  /*
   * Weight under the near ground. On the back layer deliberately: on the
   * front it darkens the hare, the one thing in the scene that must not lose
   * contrast.
   */
  const floor = (ctx: CanvasRenderingContext2D): void => {
    const top = boxHeight - 230 * world;
    const gradient = ctx.createLinearGradient(0, top, 0, boxHeight);
    gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0.34)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, top, boxWidth, boxHeight - top);
  };

  /* ---------------------------------------------------------------- */

  return {
    layout(width: number, height: number): void {
      boxWidth = Math.max(1, width);
      boxHeight = Math.max(1, height);

      /*
       * The two numbers the whole scene hangs off. See the module note and
       * `FIELD_OF_VIEW_FLOOR`.
       */
      const aspect = Math.min(1, boxWidth / boxHeight / REFERENCE_ASPECT);
      const view = Math.max(FIELD_OF_VIEW_FLOOR, aspect);
      projection = GROUND_SPAN * boxHeight * view;
      horizon = boxHeight - projection / BOTTOM_DEPTH;
      world = projection / REFERENCE_PROJECTION;

      /*
       * Density is measured against how wide the field is IN SCENE TERMS, not
       * in pixels. A narrow hero that has stepped its camera back is showing
       * more field than its width suggests, and needs the stems to match.
       */
      const density = boxWidth / world / REFERENCE_WIDTH;
      const margin = 140 * world;
      const rng = random(FIELD_SEED);
      const built: Stem[] = [];

      /*
       * Clump centres. Three quarters of the growth is placed around one of
       * these and the rest scattered between them. A real field clumps, and
       * at distance the clumping is most of what you see, which is why evenly
       * scattered stems look wrong however carefully they are drawn.
       */
      const clumps: number[] = [];
      const clumpCount = Math.max(4, Math.round(CLUMP_COUNT * density));
      for (let i = 0; i < clumpCount; i += 1) {
        clumps.push(-margin + rng() * (boxWidth + margin * 2));
      }
      const clumped = (spread: number): number => {
        if (rng() < 0.26) return -margin + rng() * (boxWidth + margin * 2);
        const centre =
          clumps[Math.floor(rng() * clumps.length)] ?? boxWidth / 2;
        /* Difference of two uniforms: a triangular spread, densest at the centre. */
        return centre + (rng() - rng()) * spread * world;
      };

      const add = (
        z: number,
        x: number,
        heightRatio: number,
        veilAmount: number,
      ): void => {
        const root = groundAt(z);
        built.push({
          z,
          scale: 1 / z,
          size: (root - horizon) / REFERENCE_PROJECTION,
          x,
          root,
          height: heightRatio * (root - horizon),
          tone: rng(),
          phase: rng() * Math.PI * 2,
          veil: veilAmount,
          lean: 0,
          leanRate: 0,
        });
      };

      const band = (
        spec: (typeof BANDS)[keyof typeof BANDS],
        spread: number,
        veilAmount: number,
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
          add(z, x, spec.height[0] + rng() * spec.height[1], veilAmount);
        }
      };

      band(BANDS.FAR, 150, 1, true);
      band(BANDS.GRASS, 105, 1, true);
      band(BANDS.MIDDLE, 190, 1, true);
      band(BANDS.HARE, 190, 1, true);
      /*
       * The near frame is the exception to every rule above: five stems,
       * always at the left edge whatever the width, mostly cropped, held back
       * to 72% opacity. More of them, or at full opacity, compete with the
       * name beside them; scattered across the width they put blurred stalks
       * over the type.
       */
      band(BANDS.NEAR, 0, NEAR_VEIL, false);

      /* Far to near, so within a layer they overlap correctly. */
      built.sort((a, b) => b.z - a.z);
      stems = built;

      hareRoot = groundAt(HARE_DEPTH);
      hareScale = (projection / HARE_DEPTH) * HARE_UNIT;

      /*
       * The route is rebuilt too: it is measured in pixels across the box,
       * and its hops scale with the projection, so a smaller hare takes
       * smaller bounds rather than clearing half the screen in one.
       */
      const routeRng = random(ROUTE_SEED);
      const segments: Segment[] = [];
      const edge = ROUTE_MARGIN * world;
      let x = -edge;
      let total = 0;
      let sinceRest = 0;

      while (x < boxWidth + edge) {
        if (sinceRest > REST_MIN_HOPS - 1 && routeRng() < REST_ODDS) {
          segments.push({
            kind: 'rest',
            duration: routeRng() < REST_LONG_ODDS ? REST_LONG : REST_SHORT,
            x0: x,
            x1: x,
            hop: 0,
            start: 0,
          });
          sinceRest = 0;
        } else {
          const roll = routeRng();
          const hop =
            HOPS.find((candidate) => roll < candidate.odds) ??
            HOPS[HOPS.length - 1];
          segments.push({
            kind: 'hop',
            /* Long leaps take longer, which is what stops them looking like a skip. */
            duration: 0.34 + hop.distance / 420,
            x0: x,
            x1: x + hop.distance * world,
            hop: hop.height * world,
            start: 0,
          });
          x += hop.distance * world;
          sinceRest += 1;
        }
      }
      for (const segment of segments) {
        segment.start = total;
        total += segment.duration;
      }
      route = { segments, total: Math.max(total, 0.001) };
      cachedAt = Number.NaN;
    },

    step(seconds: number, delta: number): void {
      const here = routeAt(seconds);
      /*
       * The hare's speed by difference rather than from the segment, so a
       * rest reads as zero and the impulse follows the actual motion. The
       * guard catches the route wrapping from one edge to the other, which
       * would otherwise register as one shove across the whole field.
       */
      let speed = (here.x - routeCalc(seconds - 0.05).x) / 0.05;
      if (Math.abs(speed) > SPEED_LIMIT_RATIO * projection) speed = 0;
      const limit = LEAN_LIMIT_RATIO * projection;

      for (const stem of stems) {
        let force = 0;
        const depth = Math.abs(stem.z - HARE_DEPTH) / HARE_DEPTH;
        if (depth < REACH_DEPTH) {
          /* About the hare's own body width, so it reads as touching rather than as a gust. */
          const reach = (58 + stem.size * 110) * world;
          const gap = stem.x - here.x;
          if (Math.abs(gap) < reach) {
            const proximity = 1 - Math.abs(gap) / reach;
            const side = gap * speed < 0 ? REACH_BEHIND : REACH_AHEAD;
            force =
              proximity *
              proximity *
              (1 - depth / REACH_DEPTH) *
              speed *
              SPRING.impulse *
              side;
          }
        }
        stem.leanRate +=
          (-SPRING.stiffness * stem.lean -
            SPRING.damping * stem.leanRate +
            force) *
          delta;
        stem.lean += stem.leanRate * delta;
        if (stem.lean > limit) {
          stem.lean = limit;
          stem.leanRate = 0;
        } else if (stem.lean < -limit) {
          stem.lean = -limit;
          stem.leanRate = 0;
        }
      }
    },

    back(ctx: CanvasRenderingContext2D, seconds: number): void {
      for (const stem of stems) if (stem.z > 7) paint(ctx, stem, seconds);
      ctx.globalAlpha = 1;
      veil(ctx);
      for (const stem of stems) {
        if (stem.z <= 7 && stem.z >= HARE_DEPTH) paint(ctx, stem, seconds);
      }
      ctx.globalAlpha = 1;
      floor(ctx);
      ctx.globalAlpha = 1;
    },

    mid(ctx: CanvasRenderingContext2D, seconds: number): void {
      const here = routeAt(seconds);
      const frame = hopFrame(here.cycle, here.sit, seconds);

      /* The shadow shrinks as it rises, which is what sells the height. */
      ctx.globalAlpha = 0.2 * (1 - frame.air);
      ctx.fillStyle = palette.border;
      ctx.beginPath();
      ctx.ellipse(
        here.x,
        hareRoot + 2,
        30 * hareScale,
        4.2 * hareScale,
        0,
        0,
        Math.PI * 2,
      );
      ctx.fill();
      ctx.globalAlpha = 1;

      drawHare(
        ctx,
        here.x,
        hareRoot - FOOT_Y * hareScale - frame.air * here.hop * hareScale,
        hareScale,
        frame,
        palette,
      );

      /* Everything between the hare and you, but still in focus. */
      for (const stem of stems) {
        if (stem.z < HARE_DEPTH && stem.z >= FRONT_DEPTH)
          paint(ctx, stem, seconds);
      }
      ctx.globalAlpha = 1;
    },

    nearBlur(): number {
      return NEAR_BLUR * world;
    },

    near(ctx: CanvasRenderingContext2D, seconds: number): void {
      for (const stem of stems)
        if (stem.z < FRONT_DEPTH) paint(ctx, stem, seconds);
      ctx.globalAlpha = 1;
    },
  };
};
