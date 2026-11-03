/*
 * Living stems: the planted-brick plants (ink stems, olive buds, a closed pink
 * bud, two-leaf sprouts) in four depth layers, hazed toward the gold behind,
 * each swaying on its own and bending away from the rabbit.
 */

type Kind = 'bud' | 'flower' | 'sprout';

interface Layer {
  /** Stems per 100 CSS px of band. */
  readonly density: number;
  /** Share of the band's height. */
  readonly height: readonly [number, number];
  readonly line: number;
  readonly alpha: number;
  /** Gold veil drawn over this layer and those behind it, 0 to 1. */
  readonly haze: number;
  /** Tip push in px when the rabbit is beside the stem. */
  readonly push: number;
  /** Bud and leaf scale. */
  readonly size: number;
  readonly front: boolean;
}

const LAYERS: readonly Layer[] = [
  {
    density: 9,
    height: [0.2, 0.34],
    line: 1,
    alpha: 0.5,
    haze: 0.45,
    push: 4,
    size: 0.45,
    front: false,
  },
  {
    density: 7,
    height: [0.28, 0.46],
    line: 1.3,
    alpha: 0.7,
    haze: 0.28,
    push: 10,
    size: 0.6,
    front: false,
  },
  {
    density: 4.5,
    height: [0.36, 0.58],
    line: 1.7,
    alpha: 1,
    haze: 0,
    push: 20,
    size: 0.8,
    front: false,
  },
  {
    density: 1.4,
    height: [0.5, 0.72],
    line: 2.2,
    alpha: 1,
    haze: 0,
    push: 34,
    size: 1,
    front: true,
  },
];

const KIND_ODDS: readonly [Kind, number][] = [
  ['flower', 0.07],
  ['sprout', 0.2],
  ['bud', 1],
];
const BRANCH_ODDS = 0.4;
const BRANCH_AT = 0.55;
const BRANCH_REACH = 0.22;
const SPROUT_HEIGHT = 0.35;
const LEAN_PX = 8;
const SWAY_PX = [2.5, 6] as const;
const SWAY_PERIOD_S = [2.6, 5.2] as const;
/* A bud nods behind its stem by this share of a sway cycle. */
const NOD_LAG = 0.12;
const REACH_PX = 80;
/* Share of the gap to the target bend closed per frame: a soft spring. */
const BEND_EASE = 0.16;
const HOLE_CLEAR_PX = 8;
const SEED = 9137;
const CONTROL_RISE = 0.55;
const CONTROL_LEAN = 0.3;
const OUTLINE = 1.2;
const FULL_TURN = Math.PI * 2;

interface Stem {
  readonly x: number;
  readonly height: number;
  readonly lean: number;
  readonly sway: number;
  readonly period: number;
  readonly phase: number;
  readonly layer: Layer;
  readonly kind: Kind;
  readonly branch: number;
  bend: number;
}

interface Palette {
  readonly ink: string;
  readonly bud: string;
  readonly flower: string;
  readonly gold: string;
}

export interface Meadow {
  /** Draws at `seconds` of meadow time; `still` draws upright stems with no sway or bend. */
  draw: (seconds: number, still: boolean) => void;
}

interface MeadowParts {
  readonly band: HTMLElement;
  readonly back: HTMLCanvasElement;
  readonly front: HTMLCanvasElement;
  readonly hopper: HTMLElement;
  readonly mouth: HTMLElement;
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

const pickKind = (roll: number): Kind =>
  KIND_ODDS.find(([, odds]) => roll < odds)?.[0] ?? 'bud';

const readPalette = (band: HTMLElement): Palette => {
  const style = getComputedStyle(band);
  const token = (name: string): string => {
    const value = style.getPropertyValue(name).trim();
    if (!value) throw new Error(`home-meadow: ${name} is not set.`);
    return value;
  };
  return {
    ink: token('--color-block-ink'),
    bud: token('--color-home-grass'),
    flower: token('--color-pink'),
    gold: token('--color-block-gold'),
  };
};

const contextOf = (canvas: HTMLCanvasElement): CanvasRenderingContext2D => {
  const context = canvas.getContext('2d');
  if (!context) throw new Error('home-meadow: no 2D context.');
  return context;
};

export const createMeadow = ({
  band,
  back,
  front,
  hopper,
  mouth,
}: MeadowParts): Meadow => {
  const behind = contextOf(back);
  const over = contextOf(front);
  const palette = readPalette(band);
  let stems: Stem[] = [];
  let width = 0;
  let height = 0;
  let ground = 0;
  let hole: readonly [number, number] = [0, 0];

  const plant = (): void => {
    const box = band.getBoundingClientRect();
    const scale = window.devicePixelRatio || 1;
    width = box.width;
    height = box.height;
    const ledge =
      parseFloat(getComputedStyle(band).getPropertyValue('--ledge-h')) || 0;
    const post =
      parseFloat(getComputedStyle(band).getPropertyValue('--post-w')) || 0;
    ground = height - ledge;
    for (const [canvas, context] of [
      [back, behind],
      [front, over],
    ] as const) {
      canvas.width = Math.round(width * scale);
      canvas.height = Math.round(height * scale);
      context.setTransform(scale, 0, 0, scale, 0, 0);
    }
    const opening = mouth.getBoundingClientRect();
    hole = [
      opening.left - box.left - post - HOLE_CLEAR_PX,
      opening.right - box.left + post + HOLE_CLEAR_PX,
    ];
    const next = seeded(SEED);
    stems = LAYERS.flatMap((layer) => {
      const count = Math.round((width / 100) * layer.density);
      return Array.from({ length: count }, (): Stem | null => {
        const x = next() * width;
        const kind = pickKind(next());
        const rise = between(next, layer.height) * height;
        const stem: Stem = {
          x,
          height: kind === 'sprout' ? rise * SPROUT_HEIGHT : rise,
          lean: (next() - 0.5) * 2 * LEAN_PX,
          sway: between(next, SWAY_PX),
          period: between(next, SWAY_PERIOD_S),
          phase: next() * FULL_TURN,
          layer,
          kind,
          branch:
            kind === 'bud' && next() < BRANCH_ODDS
              ? next() < 0.5
                ? -1
                : 1
              : 0,
          bend: 0,
        };
        return x > hole[0] && x < hole[1] ? null : stem;
      }).filter((stem): stem is Stem => stem !== null);
    });
  };

  const rabbitX = (): number => {
    const box = band.getBoundingClientRect();
    const r = hopper.getBoundingClientRect();
    return r.left - box.left + r.width / 2;
  };

  const blob = (
    context: CanvasRenderingContext2D,
    fill: string,
    line: number,
    trace: () => void,
  ): void => {
    context.beginPath();
    trace();
    context.fillStyle = fill;
    context.fill();
    context.lineWidth = line;
    context.strokeStyle = palette.ink;
    context.stroke();
  };

  const drawStem = (
    context: CanvasRenderingContext2D,
    stem: Stem,
    seconds: number,
    still: boolean,
    near: number,
  ): void => {
    const { layer } = stem;
    const away = stem.x - near;
    const target =
      still || Math.abs(away) > REACH_PX
        ? 0
        : Math.sign(away) * layer.push * (1 - Math.abs(away) / REACH_PX);
    stem.bend = still ? 0 : stem.bend + (target - stem.bend) * BEND_EASE;
    const wave = still
      ? 0
      : Math.sin((seconds / stem.period) * FULL_TURN + stem.phase);
    const nod = still
      ? 0
      : Math.sin((seconds / stem.period - NOD_LAG) * FULL_TURN + stem.phase) *
        stem.sway *
        0.3;
    const tipX = stem.x + stem.lean + wave * stem.sway + stem.bend;
    const tipY = ground - stem.height;
    const controlX = stem.x + (tipX - stem.x) * CONTROL_LEAN;
    const controlY = ground - stem.height * CONTROL_RISE;
    const s = layer.size;
    const outline = OUTLINE * s;

    context.globalAlpha = layer.alpha;
    context.lineCap = 'round';
    context.lineWidth = layer.line;
    context.strokeStyle = palette.ink;
    context.beginPath();
    context.moveTo(stem.x, ground);
    context.quadraticCurveTo(controlX, controlY, tipX, tipY);
    if (stem.branch) {
      const t = BRANCH_AT;
      const bx =
        (1 - t) ** 2 * stem.x + 2 * (1 - t) * t * controlX + t ** 2 * tipX;
      const by =
        (1 - t) ** 2 * ground + 2 * (1 - t) * t * controlY + t ** 2 * tipY;
      const reach = stem.height * BRANCH_REACH;
      context.moveTo(bx, by);
      context.quadraticCurveTo(
        bx + stem.branch * reach * 0.5,
        by - reach * 0.4,
        bx + stem.branch * reach + nod,
        by - reach,
      );
      context.stroke();
      blob(context, palette.bud, outline, () =>
        context.ellipse(
          bx + stem.branch * reach + nod,
          by - reach - 2.5 * s,
          2 * s,
          3.2 * s,
          stem.branch * 0.5,
          0,
          FULL_TURN,
        ),
      );
    } else {
      context.stroke();
    }

    const x = tipX + nod;
    if (stem.kind === 'bud') {
      blob(context, palette.bud, outline, () =>
        context.ellipse(
          x,
          tipY - 3 * s,
          2.6 * s,
          4.2 * s,
          wave * 0.08,
          0,
          FULL_TURN,
        ),
      );
    } else if (stem.kind === 'flower') {
      blob(context, palette.flower, outline, () => {
        context.moveTo(x - 5 * s, tipY);
        context.quadraticCurveTo(x - 5 * s, tipY - 10 * s, x, tipY - 12 * s);
        context.quadraticCurveTo(x + 5 * s, tipY - 10 * s, x + 5 * s, tipY);
        context.quadraticCurveTo(x, tipY + 3 * s, x - 5 * s, tipY);
      });
    } else {
      blob(context, palette.bud, outline, () => {
        context.moveTo(x, tipY);
        context.quadraticCurveTo(x - 8 * s, tipY, x - 9 * s, tipY - 7 * s);
        context.quadraticCurveTo(x - 2 * s, tipY - 7 * s, x, tipY);
        context.moveTo(x, tipY - 2 * s);
        context.quadraticCurveTo(
          x + 7 * s,
          tipY - 3 * s,
          x + 9 * s,
          tipY - 10 * s,
        );
        context.quadraticCurveTo(x + 2 * s, tipY - 10 * s, x, tipY - 2 * s);
      });
    }
  };

  /* The veil stops at the ground and skips the hole, so the bricks and opening keep their color. */
  const veil = (amount: number): void => {
    behind.globalAlpha = amount;
    behind.fillStyle = palette.gold;
    behind.fillRect(0, 0, hole[0], ground);
    behind.fillRect(hole[1], 0, width - hole[1], ground);
  };

  const draw = (seconds: number, still: boolean): void => {
    behind.clearRect(0, 0, width, height);
    over.clearRect(0, 0, width, height);
    const near = rabbitX();
    for (const layer of LAYERS) {
      const context = layer.front ? over : behind;
      for (const stem of stems)
        if (stem.layer === layer) drawStem(context, stem, seconds, still, near);
      if (layer.haze) veil(layer.haze);
    }
    behind.globalAlpha = 1;
    over.globalAlpha = 1;
  };

  let last: [number, boolean] = [0, true];
  new ResizeObserver(() => {
    plant();
    draw(...last);
  }).observe(band);
  plant();

  return {
    draw: (seconds, still) => {
      last = [seconds, still];
      draw(seconds, still);
    },
  };
};
