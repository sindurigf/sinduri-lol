/*
 * The stems along the top of the footer, drawn once as an SVG tile.
 *
 * scripts/footer-field.mjs writes this to src/assets/footer-field.svg and the
 * footer paints that file as a background. The field never moves, so as a
 * still image it needs no script on any route, no pause control (SC 2.2.2)
 * and no CSP hash, and it is there with scripting off.
 *
 * tests/footer.spec.ts compares the committed file with this function's
 * output, so an edit here that is not regenerated fails, and so does a
 * retoned colour token.
 *
 * It is the footer comp's drawing: the same seed, stem count, lean, heights,
 * leaves and colours, minus the hare. The hare lies over the sticker row, a
 * place the layout decides, so it is an inline SVG in Footer.astro rather
 * than part of a repeating tile.
 *
 * ONE TILE, REPEATED. The footer is as wide as the screen, so the drawing
 * repeats across it. A stem whose lean or leaves cross an edge is drawn again
 * one tile over, so no stem is cut at a seam.
 */

export const FIELD_OUTPUT = 'src/assets/footer-field.svg';
export const TOKEN_SOURCE = 'src/styles/global.css';

/* 1440 wide so one tile covers the comp's desktop frame without a seam. */
const TILE_WIDTH = 1440;
const TILE_HEIGHT = 150;

/* One stem for every 10px of tile, as in the comp. */
const STEM_PITCH = 10;
/* The stems root this far above the bottom edge. */
const GROUND_INSET = 4;
/* How far a leaf can reach sideways past the stem's own lean. */
const LEAF_REACH = 12;
/* The comp's seed. Change it and the field is a different field. */
const SEED = 4211;
/* Leaves tilt this far off the stem, in radians, alternating sides. */
const LEAF_TILT = 0.3;

export interface FieldPalette {
  readonly border: string;
  readonly subtle: string;
  readonly muted: string;
}

/**
 * The three colours the stems use, read from the token source.
 *
 * An image cannot read CSS custom properties, so the values are written into
 * the file. Reading them from `@theme` rather than copying them here means a
 * retoned token changes the drawing on the next regeneration, and the drift
 * test in tests/footer.spec.ts fails until that happens.
 */
export const readPalette = (css: string): FieldPalette => {
  const token = (name: string): string => {
    const match = new RegExp(`--color-${name}:\\s*(#[0-9a-fA-F]{6});`).exec(
      css,
    );
    if (!match?.[1]) {
      throw new Error(
        `--color-${name} is not a six-digit hex in ${TOKEN_SOURCE}; ` +
          'the footer field cannot be drawn without it',
      );
    }
    return match[1].toLowerCase();
  };
  return {
    border: token('border'),
    subtle: token('subtle'),
    muted: token('muted'),
  };
};

/* The comp's generator: a linear congruential one, so the field is repeatable. */
const createRandom = (seed: number): (() => number) => {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
};

/* Shortest decimal form, so the file stays small. */
const num = (value: number, places = 1): string =>
  String(Number(value.toFixed(places)));

interface Stem {
  readonly x: number;
  readonly depth: number;
  readonly hue: number;
  readonly lean: number;
  readonly height: number;
}

export const fieldSvg = (palette: FieldPalette): string => {
  const random = createRandom(SEED);
  const ground = TILE_HEIGHT - GROUND_INSET;

  /* The call order matches the comp's, so the same seed draws the same field. */
  const stems: Stem[] = [];
  for (let i = 0; i < Math.round(TILE_WIDTH / STEM_PITCH); i++) {
    const depth = random();
    const x = random() * TILE_WIDTH;
    const hue = random();
    const lean = (random() - 0.5) * 16;
    const height =
      (18 + random() ** 1.5 * (TILE_HEIGHT - 30)) * (0.55 + depth * 0.45);
    stems.push({ x, depth, hue, lean, height });
  }
  /* Far stems first, so nearer ones are drawn over them. */
  stems.sort((a, b) => a.depth - b.depth);

  /* A point on the stem's curve, from the root (0) to the tip (1). */
  const along = (stem: Stem, x: number, t: number): [number, number] => {
    const m = 1 - t;
    const x1 = x + stem.lean * 0.18;
    const y1 = ground - stem.height * 0.45;
    const x2 = x + stem.lean * 0.62;
    const y2 = ground - stem.height * 0.8;
    return [
      m * m * m * x +
        3 * m * m * t * x1 +
        3 * m * t * t * x2 +
        t * t * t * (x + stem.lean),
      m * m * m * ground +
        3 * m * m * t * y1 +
        3 * m * t * t * y2 +
        t * t * t * (ground - stem.height),
    ];
  };

  const draw = (stem: Stem, x: number): string => {
    const alpha = 0.12 + stem.depth * 0.42;
    const curve =
      `M${num(x)} ${num(ground)}` +
      `C${num(x + stem.lean * 0.18)} ${num(ground - stem.height * 0.45)} ` +
      `${num(x + stem.lean * 0.62)} ${num(ground - stem.height * 0.8)} ` +
      `${num(x + stem.lean)} ${num(ground - stem.height)}`;
    let out =
      `<path d="${curve}" stroke="${palette.border}" ` +
      `stroke-opacity="${num(alpha, 2)}" stroke-width="${num(0.8 + stem.depth * 1.3, 2)}"/>`;

    /* Short stems are grass; only the taller ones carry leaves and a bud. */
    if (stem.height < 26) return out;

    const bud = 0.5 + stem.depth * 0.9;
    const colour =
      stem.hue > 0.8
        ? palette.muted
        : stem.hue > 0.55
          ? palette.subtle
          : palette.border;
    const leaves: string[] = [];
    const count = stem.height > 70 ? 3 : 2;
    for (let j = 0; j < count; j++) {
      const [px, py] = along(stem, x, 0.6 + j * 0.15);
      const side = j % 2 ? 1 : -1;
      const cx = num(px + side * 3 * bud);
      const cy = num(py);
      leaves.push(
        `<ellipse cx="${cx}" cy="${cy}" rx="${num(2.4 * bud)}" ry="${num(4.2 * bud)}" ` +
          `transform="rotate(${num((side * LEAF_TILT * 180) / Math.PI)} ${cx} ${cy})"/>`,
      );
    }
    const [tx, ty] = along(stem, x, 1);
    leaves.push(
      `<ellipse cx="${num(tx)}" cy="${num(ty - 4 * bud)}" rx="${num(2.7 * bud)}" ry="${num(5 * bud)}"/>`,
    );
    out +=
      `<g stroke="${colour}" stroke-opacity="${num(Math.min(0.8, alpha + 0.15), 2)}" ` +
      `stroke-width="${num(Math.max(0.6, 0.5 + stem.depth), 2)}">${leaves.join('')}</g>`;
    return out;
  };

  const body = stems
    .map((stem) => {
      const reach = Math.abs(stem.lean) + LEAF_REACH;
      const copies = [stem.x];
      if (stem.x - reach < 0) copies.push(stem.x + TILE_WIDTH);
      if (stem.x + reach > TILE_WIDTH) copies.push(stem.x - TILE_WIDTH);
      return copies.map((x) => draw(stem, x)).join('');
    })
    .join('');

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${TILE_WIDTH}" height="${TILE_HEIGHT}" ` +
    `viewBox="0 0 ${TILE_WIDTH} ${TILE_HEIGHT}" fill="none" stroke-linecap="round">${body}</svg>\n`
  );
};
