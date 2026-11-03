/* Living stems: thin stems with small buds in three depth layers, each swaying on its own and bending away from the rabbit. */

interface Layer {
  /** Stems per 100 CSS px of band. */
  readonly density: number;
  readonly height: readonly [number, number];
  readonly width: number;
  readonly alpha: number;
  /** How far the rabbit pushes this layer, in px at the tip. */
  readonly push: number;
  readonly bud: number;
}

/* Far to near: the far layer is short, faint and barely pushed, as if behind the rabbit's path. */
const LAYERS: readonly Layer[] = [
  { density: 5, height: [0.34, 0.5], width: 1, alpha: 0.38, push: 6, bud: 1.6 },
  {
    density: 4,
    height: [0.42, 0.66],
    width: 1.4,
    alpha: 0.7,
    push: 18,
    bud: 2.2,
  },
  {
    density: 2.2,
    height: [0.5, 0.82],
    width: 1.8,
    alpha: 1,
    push: 30,
    bud: 2.8,
  },
];

const PHONE_HEIGHT_SCALE = 0.85;
const LEAN_PX = 10;
const SWAY_PX = [2, 4.5] as const;
const SWAY_PERIOD_S = [2.6, 4.8] as const;
/* Bud nods behind its stem by this share of a sway cycle. */
const NOD_LAG = 0.12;
const REACH_PX = 70;
/* Share of the gap to the target bend closed per frame: a soft spring. */
const BEND_EASE = 0.18;
const BUD_ODDS = 0.62;
const PINK_ODDS = 0.08;
const LEAF_ODDS = 0.35;
const LEAF_PX = 5;
const MOUTH_CLEAR_PX = 10;
const SEED = 9137;
const BASE_JITTER_PX = 3;
const CONTROL_RISE = 0.55;
const CONTROL_LEAN = 0.3;
const FULL_TURN = Math.PI * 2;

interface Stem {
  readonly x: number;
  readonly height: number;
  readonly lean: number;
  readonly sway: number;
  readonly period: number;
  readonly phase: number;
  readonly layer: Layer;
  readonly bud: 'none' | 'bud' | 'pink';
  readonly leaf: number;
  bend: number;
}

interface Palette {
  readonly stem: string;
  readonly ink: string;
  readonly bud: string;
  readonly accent: string;
}

export interface Meadow {
  /** Draws at `seconds` of meadow time; `still` draws upright stems, no sway or bend. */
  draw: (seconds: number, still: boolean) => void;
}

const seeded = (seed: number): (() => number) => {
  let state = seed;
  return () => {
    state = (state * 16807) % 2147483647;
    return state / 2147483647;
  };
};

const between = (
  next: () => number,
  [low, high]: readonly [number, number],
): number => low + next() * (high - low);

const readPalette = (band: HTMLElement): Palette => {
  const style = getComputedStyle(band);
  const token = (name: string): string => {
    const value = style.getPropertyValue(name).trim();
    if (!value) throw new Error(`home-meadow: ${name} is not set.`);
    return value;
  };
  return {
    stem: token('--color-home-grass'),
    ink: token('--color-block-ink'),
    bud: token('--color-block-light'),
    accent: token('--color-pink'),
  };
};

export const createMeadow = (
  band: HTMLElement,
  canvas: HTMLCanvasElement,
  hopper: HTMLElement,
  mouth: HTMLElement,
): Meadow => {
  const context = canvas.getContext('2d');
  if (!context) throw new Error('home-meadow: no 2D context.');
  const palette = readPalette(band);
  let stems: Stem[] = [];
  let width = 0;
  let height = 0;
  let ground = 0;

  const plant = (): void => {
    const box = band.getBoundingClientRect();
    const scale = window.devicePixelRatio || 1;
    width = box.width;
    height = box.height;
    ground =
      height -
      (parseFloat(getComputedStyle(band).getPropertyValue('--ledge')) || 0);
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    context.setTransform(scale, 0, 0, scale, 0, 0);
    const hole = mouth.getBoundingClientRect();
    const holeFrom = hole.left - box.left - MOUTH_CLEAR_PX;
    const holeTo = hole.right - box.left + MOUTH_CLEAR_PX;
    const phone = !window.matchMedia('(min-width: 48rem)').matches;
    const next = seeded(SEED);
    stems = LAYERS.flatMap((layer) => {
      const count = Math.round((width / 100) * layer.density);
      return Array.from({ length: count }, (_, index): Stem | null => {
        const x =
          ((index + next()) / count) * width + (next() - 0.5) * BASE_JITTER_PX;
        if (x > holeFrom && x < holeTo) return null;
        const budRoll = next();
        return {
          x,
          height:
            between(next, layer.height) *
            ground *
            (phone ? PHONE_HEIGHT_SCALE : 1),
          lean: (next() - 0.5) * 2 * LEAN_PX,
          sway: between(next, SWAY_PX),
          period: between(next, SWAY_PERIOD_S),
          phase: next() * FULL_TURN,
          layer,
          bud:
            budRoll < PINK_ODDS ? 'pink' : budRoll < BUD_ODDS ? 'bud' : 'none',
          leaf: next() < LEAF_ODDS ? next() * 0.4 + 0.25 : 0,
          bend: 0,
        };
      }).filter((stem): stem is Stem => stem !== null);
    });
  };

  const rabbitX = (): number => {
    const box = band.getBoundingClientRect();
    const r = hopper.getBoundingClientRect();
    return r.left - box.left + r.width / 2;
  };

  const drawStem = (
    stem: Stem,
    seconds: number,
    still: boolean,
    near: number,
  ): void => {
    const away = stem.x - near;
    const target =
      still || Math.abs(away) > REACH_PX
        ? 0
        : Math.sign(away) * stem.layer.push * (1 - Math.abs(away) / REACH_PX);
    stem.bend = still ? 0 : stem.bend + (target - stem.bend) * BEND_EASE;
    const wave = still
      ? 0
      : Math.sin((seconds / stem.period) * FULL_TURN + stem.phase);
    const tipX = stem.x + stem.lean + wave * stem.sway + stem.bend;
    const tipY = ground - stem.height;
    const controlX = stem.x + (tipX - stem.x) * CONTROL_LEAN;
    const controlY = ground - stem.height * CONTROL_RISE;

    context.globalAlpha = stem.layer.alpha;
    context.strokeStyle =
      stem.layer === LAYERS[LAYERS.length - 1] ? palette.ink : palette.stem;
    context.lineWidth = stem.layer.width;
    context.beginPath();
    context.moveTo(stem.x, ground);
    context.quadraticCurveTo(controlX, controlY, tipX, tipY);
    context.stroke();

    if (stem.leaf) {
      const t = stem.leaf;
      const lx =
        (1 - t) ** 2 * stem.x + 2 * (1 - t) * t * controlX + t ** 2 * tipX;
      const ly =
        (1 - t) ** 2 * ground + 2 * (1 - t) * t * controlY + t ** 2 * tipY;
      const side = stem.phase > Math.PI ? 1 : -1;
      context.beginPath();
      context.moveTo(lx, ly);
      context.quadraticCurveTo(
        lx + side * LEAF_PX,
        ly - LEAF_PX,
        lx + side * LEAF_PX * 1.6,
        ly - LEAF_PX * 0.4,
      );
      context.stroke();
    }

    if (stem.bud === 'none') return;
    const nod = still
      ? 0
      : Math.sin((seconds / stem.period - NOD_LAG) * FULL_TURN + stem.phase) *
        stem.sway *
        0.4;
    const r = stem.layer.bud;
    context.beginPath();
    context.ellipse(
      tipX + nod,
      tipY - r * 0.6,
      r * 0.8,
      r * 1.3,
      (wave * stem.sway) / 20,
      0,
      FULL_TURN,
    );
    context.fillStyle = stem.bud === 'pink' ? palette.accent : palette.bud;
    context.fill();
    context.lineWidth = 1;
    context.strokeStyle = palette.ink;
    context.stroke();
  };

  const draw = (seconds: number, still: boolean): void => {
    context.clearRect(0, 0, width, height);
    const near = rabbitX();
    for (const stem of stems) drawStem(stem, seconds, still, near);
    context.globalAlpha = 1;
  };

  let lastDraw: [number, boolean] = [0, true];
  new ResizeObserver(() => {
    plant();
    draw(...lastDraw);
  }).observe(band);
  plant();

  return {
    draw: (seconds, still) => {
      lastDraw = [seconds, still];
      draw(seconds, still);
    },
  };
};
