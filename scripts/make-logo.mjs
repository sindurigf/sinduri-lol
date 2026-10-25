#!/usr/bin/env node
/*
 * Renders the logo rabbit, its large copy for the share cards, the roundel
 * rabbit and every favicon from one traced drawing,
 * artwork/rabbit-jump.json (the jumping rabbit, Canva AI traced with
 * Potrace), in Chromium with the site tokens.
 *
 *   node scripts/make-logo.mjs
 *
 * Prints the rabbit's box in the logo tile; `--logo-rabbit-*` in
 * src/styles/global.css must match it.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { chromium } from '@playwright/test';
import sharp from 'sharp';
import { cssColorToken } from '../src/lib/css-token.ts';

const INK = cssColorToken('--color-block-ink');
const GOLD = cssColorToken('--color-block-gold');
const PINK = cssColorToken('--color-bunny');
const WHITE = cssColorToken('--color-light-ground');
/* Baked into the drawing like the hero atlas; no page sets it. */
const EAR = '#ff9cc4';

/** A Potrace path in relative commands on whole trace units, a twentieth of a pixel at the roundel's largest: a third of the bytes. */
const relative = (d) => {
  let [x, y, x0, y0] = [0, 0, 0, 0];
  let out = '';
  const num = (n) =>
    n < 0 || out.endsWith(' ') || /[a-z]$/.test(out) ? `${n}` : ` ${n}`;
  for (const [, op, args] of d.matchAll(/([A-Za-z])([^A-Za-z]*)/g)) {
    if (!'MLCZ'.includes(op))
      throw new Error(
        `make-logo: the trace has a ${op} command; relative() writes only M, L, C and Z.`,
      );
    const n = (args.match(/-?\d+(\.\d+)?/g) ?? []).map((v) =>
      Math.round(Number(v)),
    );
    if (op === 'Z') {
      out += 'z';
      [x, y] = [x0, y0];
      continue;
    }
    out += op.toLowerCase();
    const step = op === 'C' ? 6 : 2;
    for (let i = 0; i < n.length; i += step) {
      const pts = n.slice(i, i + step);
      for (let j = 0; j < pts.length; j += 2) {
        out += num(pts[j] - x);
        out += num(pts[j + 1] - y);
      }
      [x, y] = pts.slice(-2);
      /* Pairs after a moveto's first are linetos: only the first opens the subpath. */
      if (op === 'M' && i === 0) [x0, y0] = [x, y];
    }
  }
  return out;
};
/* Two outlines, `cut` and `sil`: ARCHITECTURE.md#the-favicon-set. */
const TRACE = JSON.parse(readFileSync('artwork/rabbit-jump.json', 'utf8'));
/** The SVG with every path written by `relative`. */
const shipped = (source) =>
  source.replace(/ d="([^"]+)"/g, (_, d) => ` d="${relative(d)}"`);

/* The header tile, Header.astro: 48px, `border-4`, `rounded-nav`. */
const TILE = 48;
const BORDER = 4;
/* The share cards draw the tile at 7x (TILE_SCALE in scripts/make-og.mjs); this renders the rabbit at 2x of that. */
const OG_LOGO_SCALE = 14;

/* In tile px, inside the border: the rabbit's height, tilt and where its box sits. */
const LOGO_POSE = { h: 52, rotate: -12, left: 10, bottom: 36 };
/* Hairline die-cut: ink edge, white rim, ink rim edge, ink throw. */
const STICKER = { edge: 1, rim: 1.2, rimEdge: 1, throw: 3, line: 0.2 };

/* Favicon grid: 64 units. */
const ICON = 64;
/* In 64 units: the rabbit's box, which sizes it against the rim and block. Each frame then fits the whole sticker. */
const ICON_POSE = { box: [11, 4, 46, 45], rotate: -12 };
/* Clear px kept round each tab frame, so no part of the sticker is cut at the tab's edge. */
const TAB_BORDER = 1;
/* favicon.svg is fitted as the 16px frame, the smallest a tab draws it. */
const SVG_FRAME = 16;
/* Probe render of the icon, in px per icon side, to measure the sticker's reach. */
const ICON_PROBE = 512;
/* Room round the 64-unit grid in the probe, as a share of the icon side. */
const PROBE_PAD = 0.5;
/* The tab icon: a gold rabbit, white ear, an ink rim, then a pink block behind it whose back face has an ink edge. */
const ICON_STICKER = { rim: 4, depth: 6, backEdge: 1.5, steps: 8 };
/* Opaque app icons on gold: artwork scale, and the maskable safe zone. */
const APP_SCALE = 0.8;
const MASKABLE_SCALE = 0.62;

/* The hero roundel in a 100-unit box: a die-cut rim, then a pink block behind the rabbit whose back face has an ink edge. */
const ROUNDEL = {
  h: 86,
  /* The rabbit's center in the box, right of 50 so the drawing and its block sit centered. */
  cx: 55,
  rotate: -12,
  rim: 4.5,
  edge: 0.7,
  depth: 6.5,
  backEdge: 1.5,
  steps: 24,
  line: 0.6,
};
/* Trace units: the open mouth's box, and its scale about the top of that box; full size reads heavy in the roundel. */
const MOUTH_BOX = { x0: 280, y0: 1270, x1: 610, y1: 1540 };
const MOUTH_SCALE = 0.7;
/* The art bleeds an eighth past each side of the box, as the image's wrapper does in Roundel.astro. */
const ROUNDEL_BLEED = 100 / 8;
const ROUNDEL_PX = 400;

const SPECK = 35;
const subpaths = (d) =>
  d
    .split(/(?=M)/)
    .map((p) => p.trim())
    .filter(Boolean);
const bbox = (d) => {
  const n = d.match(/-?\d+(\.\d+)?/g).map(Number);
  const xs = n.filter((_, i) => i % 2 === 0);
  const ys = n.filter((_, i) => i % 2 === 1);
  return {
    x0: Math.min(...xs),
    y0: Math.min(...ys),
    x1: Math.max(...xs),
    y1: Math.max(...ys),
  };
};
const area = (d) => {
  const b = bbox(d);
  return (b.x1 - b.x0) * (b.y1 - b.y0);
};
const largest = (d) => subpaths(d).sort((a, b) => area(b) - area(a))[0];
/* Specks under SPECK trace units are under half a pixel in the header. */
const line = subpaths(TRACE.line)
  .filter((p) => {
    const b = bbox(p);
    return Math.max(b.x1 - b.x0, b.y1 - b.y0) > SPECK;
  })
  .join(' ');

/** Mirrored to face right, scaled to `h`, turned, its box at (left, bottom). */
const placement = ({ h, rotate, left, bottom }) => {
  const b = bbox(TRACE.cut);
  const k = h / (b.y1 - b.y0);
  const w = (b.x1 - b.x0) * k;
  const transform = `translate(${left + w / 2} ${bottom - h / 2}) rotate(${rotate}) scale(${-k} ${k}) translate(${-(b.x0 + b.x1) / 2} ${-(b.y0 + b.y1) / 2})`;
  return { k, transform };
};

const fill = (d, color, stroke = 0) =>
  `<path d="${d}" fill="${color}"${stroke ? ` stroke="${color}" stroke-width="${stroke}" stroke-linejoin="round"` : ''}/>`;

const inside = (d, b) => {
  const q = bbox(d);
  return q.x0 >= b.x0 && q.y0 >= b.y0 && q.x1 <= b.x1 && q.y1 <= b.y1;
};
/** The subpaths outside and inside `box`. */
const partition = (d, box) => {
  const parts = subpaths(d);
  return [
    parts.filter((p) => !inside(p, box)).join(' '),
    parts.filter((p) => inside(p, box)).join(' '),
  ];
};

/**
 * The roundel rabbit's die-cut, drawn under the art in its own mirrored units `u`:
 * a pink block swept down and behind with an ink back edge, then a white rim and an ink edge round `#cut` and `#sil`.
 */
const dieCut = ({ rim, edge, depth, backEdge, steps }, u) => {
  /* The drawing is mirrored, so a positive offset falls down and behind the rabbit. */
  const grown = (color, width, offset = 0, ref = 'cut') =>
    `<use href="#${ref}"${offset ? ` x="${(offset * u).toFixed(2)}" y="${(offset * u).toFixed(2)}"` : ''} fill="${color}" stroke="${color}" stroke-width="${(2 * width * u).toFixed(2)}" stroke-linejoin="round"/>`;
  const offsets = Array.from(
    { length: steps },
    (_, i) => (depth * (steps - i)) / steps,
  );
  /* The ink back is swept like the block, from one edge width in, so it edges the block's far side evenly and never shows past its near side. */
  const back = offsets
    .filter((d) => d >= backEdge)
    .map((d) => grown(INK, rim + backEdge, d))
    .join('');
  const block = offsets.map((d) => grown(PINK, rim, d)).join('');
  return `${back}${block}${grown(WHITE, rim)}${grown(INK, edge, 0, 'sil')}`;
};

function roundelArt() {
  const b = bbox(TRACE.cut);
  const k = ROUNDEL.h / (b.y1 - b.y0);
  const u = 1 / k;
  const transform = `translate(${ROUNDEL.cx} 50) rotate(${ROUNDEL.rotate}) scale(${-k} ${k}) translate(${-(b.x0 + b.x1) / 2} ${-(b.y0 + b.y1) / 2})`;
  const [face, mouthLine] = partition(line, MOUTH_BOX);
  const [pink, tongue] = partition(TRACE.pink, MOUTH_BOX);
  const mx = (MOUTH_BOX.x0 + MOUTH_BOX.x1) / 2;
  const mouth = `<g transform="translate(${mx} ${MOUTH_BOX.y0}) scale(${MOUTH_SCALE}) translate(${-mx} ${-MOUTH_BOX.y0})">${fill(tongue, EAR)}${fill(mouthLine, INK, ROUNDEL.line * u)}</g>`;
  return `<defs><path id="cut" d="${TRACE.cut}"/><path id="sil" d="${TRACE.sil}"/></defs><g transform="${transform}">${dieCut(ROUNDEL, u)}
${fill(TRACE.sil, WHITE)}${fill(pink, EAR)}${fill(face, INK, ROUNDEL.line * u)}${mouth}${fill(TRACE.eye, INK)}${fill(TRACE.shine, WHITE)}</g>`;
}

function sticker() {
  const { k, transform } = placement({
    ...LOGO_POSE,
    left: LOGO_POSE.left + BORDER,
    bottom: LOGO_POSE.bottom + BORDER,
  });
  const u = 1 / k;
  const outer = (STICKER.edge + 2 * STICKER.rim + 2 * STICKER.rimEdge) * u;
  const use = (ref, color, stroke = 0, offset = 0) =>
    `<use href="#${ref}"${offset ? ` x="${offset.toFixed(2)}" y="${offset.toFixed(2)}"` : ''} fill="${color}"${stroke ? ` stroke="${color}" stroke-width="${stroke.toFixed(2)}" stroke-linejoin="round"` : ''}/>`;
  return `<defs><path id="cut" d="${TRACE.cut}"/><path id="sil" d="${TRACE.sil}"/></defs><g transform="${transform}">
${use('cut', INK, outer, STICKER.throw * u)}
${use('cut', INK, outer)}${use('cut', WHITE, (STICKER.edge + 2 * STICKER.rim) * u)}${use('sil', INK, STICKER.edge * u)}${use('sil', WHITE)}
${fill(TRACE.pink, EAR)}${fill(line, INK, STICKER.line * u)}${fill(TRACE.eye, INK)}${fill(TRACE.shine, WHITE)}</g>`;
}

/* Bakes a transform into absolute M/L/C coordinates, for the PNG icons. */
function bake(d, { a, b, c, e, f, g }) {
  const nums = d.match(/-?\d+(\.\d+)?/g).map(Number);
  let i = 0;
  return d.replace(/-?\d+(\.\d+)?\s*,?\s*-?\d+(\.\d+)?/g, () => {
    const x = nums[i++];
    const y = nums[i++];
    return `${(a * x + c * y + e).toFixed(1)} ${(b * x + g * y + f).toFixed(1)}`;
  });
}

/* favicon.svg: curves flattened, thinned and rounded to whole units of a grid FINE times the icon's. */
const FINE = 4;
const CURVE_STEPS = 6;
const THIN = 1;

const flatten = (d, { a, b, c, e, f, g }) => {
  const at = (x, y) => [(a * x + c * y + e) * FINE, (b * x + g * y + f) * FINE];
  const rings = [];
  let ring = null;
  for (const [, op, args] of d.matchAll(/([MLC])([^MLCZ]*)/g)) {
    const n = args.match(/-?\d+(\.\d+)?/g).map(Number);
    if (op === 'M') rings.push((ring = [at(n[0], n[1])]));
    else if (op === 'L') ring.push(at(n[0], n[1]));
    else {
      for (let k = 0; k < n.length; k += 6) {
        const [p0x, p0y] = ring.at(-1);
        const [p1, p2, p3] = [
          at(n[k], n[k + 1]),
          at(n[k + 2], n[k + 3]),
          at(n[k + 4], n[k + 5]),
        ];
        for (let s = 1; s <= CURVE_STEPS; s += 1) {
          const t = s / CURVE_STEPS;
          const u = 1 - t;
          ring.push([
            u ** 3 * p0x +
              3 * u * u * t * p1[0] +
              3 * u * t * t * p2[0] +
              t ** 3 * p3[0],
            u ** 3 * p0y +
              3 * u * u * t * p1[1] +
              3 * u * t * t * p2[1] +
              t ** 3 * p3[1],
          ]);
        }
      }
    }
  }
  return rings;
};

/* Ramer-Douglas-Peucker: drops points within THIN of the line between kept ones. */
const thin = (points) => {
  if (points.length < 3) return points;
  const [ax, ay] = points[0];
  const [bx, by] = points.at(-1);
  const length = Math.hypot(bx - ax, by - ay) || 1;
  let far = 0;
  let at = 0;
  points.forEach(([x, y], i) => {
    const distance =
      Math.abs((bx - ax) * (ay - y) - (ax - x) * (by - ay)) / length;
    if (distance > far) [far, at] = [distance, i];
  });
  if (far <= THIN) return [points[0], points.at(-1)];
  return [
    ...thin(points.slice(0, at + 1)).slice(0, -1),
    ...thin(points.slice(at)),
  ];
};

/* A closed ring starts and ends on one point, so it is split at the point farthest from it. */
const thinRing = (ring) => {
  const [x0, y0] = ring[0];
  let at = 0;
  ring.forEach(([x, y], i) => {
    if (
      Math.hypot(x - x0, y - y0) >
      Math.hypot(ring[at][0] - x0, ring[at][1] - y0)
    )
      at = i;
  });
  return [...thin(ring.slice(0, at + 1)).slice(0, -1), ...thin(ring.slice(at))];
};

/* Catmull-Rom through the kept points, so the thinned outline stays round instead of faceted. */
const smooth = (ring) => {
  const n = ring.length;
  const p = (i) => ring[(i + n) % n];
  const r = (v) => Math.round(v);
  let d = `M${ring[0].join(' ')}`;
  for (let i = 0; i < n; i += 1) {
    const [a, b, c, e] = [p(i - 1), p(i), p(i + 1), p(i + 2)];
    d += `C${r(b[0] + (c[0] - a[0]) / 6)} ${r(b[1] + (c[1] - a[1]) / 6)} ${r(c[0] - (e[0] - b[0]) / 6)} ${r(c[1] - (e[1] - b[1]) / 6)} ${c.join(' ')}`;
  }
  return `${d}Z`;
};

const compact = (d, m) =>
  flatten(d, m)
    .map((ring) =>
      thinRing(ring).map(([x, y]) => [Math.round(x), Math.round(y)]),
    )
    .filter((ring) => ring.length > 2)
    .map(smooth)
    .join('');

function iconArtwork({ precise }) {
  const s = bbox(TRACE.cut);
  const [bx, by, bw, bh] = ICON_POSE.box;
  const k = Math.min(bw / (s.x1 - s.x0), bh / (s.y1 - s.y0));
  const r = (ICON_POSE.rotate * Math.PI) / 180;
  const [cx, cy] = [bx + bw / 2, by + bh / 2];
  const [mx, my] = [(s.x0 + s.x1) / 2, (s.y0 + s.y1) / 2];
  const sx = -k;
  const m = {
    a: Math.cos(r) * sx,
    b: Math.sin(r) * sx,
    c: -Math.sin(r) * k,
    g: Math.cos(r) * k,
  };
  m.e = cx - m.a * mx - m.c * my;
  m.f = cy - m.b * mx - m.g * my;
  const path = (d) => (precise ? bake(d, m) : compact(d, m));
  const unit = precise ? 1 : FINE;
  const { rim, depth, backEdge, steps } = ICON_STICKER;
  const outer = 2 * rim * unit;
  /* The rabbit faces right, so the block falls down and to the left, behind it. */
  const use = (color, width, off = 0) =>
    `<use href="#r" fill="${color}" stroke="${color}" stroke-width="${width}" stroke-linejoin="round"${off ? ` x="${-off * unit}" y="${off * unit}"` : ''}/>`;
  const block = Array.from({ length: steps }, (_, i) =>
    use(PINK, outer, (depth * (steps - i)) / steps),
  ).join('');
  return `<defs><path id="r" d="${path(TRACE.cut)}"/></defs>${use(INK, 2 * (rim + backEdge) * unit, depth)}${block}${use(INK, outer)}<use href="#r" fill="${GOLD}"/>${fill(path(largest(TRACE.pink)), WHITE)}${fill(path(largest(TRACE.eye)), INK)}`;
}

const svg = (viewBox, body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}">${body}</svg>\n`;

/* The tab PNGs and the app icons keep the full curves; favicon.svg is the small copy. */
const iconFull = iconArtwork({ precise: true });
const iconSmall = iconArtwork({ precise: false });

const browser = await chromium.launch();
const page = await browser.newPage();

/** Rasterises `source` at width×height; returns RGBA pixels and a PNG. */
const raster = (source, width, height) =>
  page.evaluate(
    async ({ source, width, height }) => {
      const url = URL.createObjectURL(
        new Blob([source], { type: 'image/svg+xml' }),
      );
      const image = new Image();
      image.src = url;
      await image.decode();
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext('2d');
      context.drawImage(image, 0, 0, width, height);
      return {
        alpha: Array.from(
          context
            .getImageData(0, 0, width, height)
            .data.filter((_, i) => i % 4 === 3),
        ),
        png: canvas.toDataURL('image/png').split(',')[1],
      };
    },
    { source, width, height },
  );

/* The stickers are drawn at SUPERSAMPLE times their size and downscaled once, so the stacked block copies leave no seams. */
const SUPERSAMPLE = 4;
const crisp = async (source, width, height) =>
  sharp(
    Buffer.from(
      (await raster(source, width * SUPERSAMPLE, height * SUPERSAMPLE)).png,
      'base64',
    ),
  )
    .resize(width, height, { kernel: 'lanczos3' })
    .png()
    .toBuffer();

/** The px box of every pixel with any alpha in a `width`-wide raster. */
const alphaBox = (alpha, width) => {
  let [x0, y0, x1, y1] = [width, alpha.length / width, 0, 0];
  alpha.forEach((a, i) => {
    if (!a) return;
    const [x, y] = [i % width, Math.floor(i / width)];
    [x0, y0, x1, y1] = [
      Math.min(x0, x),
      Math.min(y0, y),
      Math.max(x1, x + 1),
      Math.max(y1, y + 1),
    ];
  });
  return [x0, y0, x1, y1];
};

/* Logo rabbit: find its box in tile px around the tile, then render that box. */
const REACH = 40;
const span = TILE + 2 * REACH;
const probe = await raster(
  svg(`${-REACH} ${-REACH} ${span} ${span}`, sticker()),
  span,
  span,
);
const [x0, y0, x1, y1] = alphaBox(probe.alpha, span);
if (x0 === 0 || y0 === 0 || x1 === span || y1 === span) {
  throw new Error('The logo rabbit reaches the probe edge; raise REACH.');
}
const box = {
  left: x0 - REACH,
  top: y0 - REACH,
  width: x1 - x0,
  height: y1 - y0,
};
writeFileSync(
  'src/assets/logo-rabbit.svg',
  shipped(
    svg(`${box.left} ${box.top} ${box.width} ${box.height}`, sticker()).replace(
      '<svg ',
      `<svg width="${box.width}" height="${box.height}" `,
    ),
  ),
);
writeFileSync(
  'artwork/logo-rabbit-og.png',
  await crisp(
    svg(`${box.left} ${box.top} ${box.width} ${box.height}`, sticker()),
    box.width * OG_LOGO_SCALE,
    box.height * OG_LOGO_SCALE,
  ),
);

const roundelSide = 100 + 2 * ROUNDEL_BLEED;
const roundel = await raster(
  svg(
    `${-ROUNDEL_BLEED} ${-ROUNDEL_BLEED} ${roundelSide} ${roundelSide}`,
    roundelArt(),
  ),
  ROUNDEL_PX,
  ROUNDEL_PX,
);
const edgeRows = [0, ROUNDEL_PX - 1];
const touches = roundel.alpha.some((a, i) => {
  const [x, y] = [i % ROUNDEL_PX, Math.floor(i / ROUNDEL_PX)];
  return a > 0 && (edgeRows.includes(x) || edgeRows.includes(y));
});
if (touches)
  throw new Error(
    'The roundel rabbit reaches its bleed edge; widen ROUNDEL_BLEED.',
  );
writeFileSync(
  'src/assets/roundel-rabbit.svg',
  shipped(
    svg(
      `${-ROUNDEL_BLEED} ${-ROUNDEL_BLEED} ${roundelSide} ${roundelSide}`,
      roundelArt(),
    ),
  ),
);

const png = async (source, size) =>
  Buffer.from((await raster(source, size, size)).png, 'base64');

/** The sticker's reach in its own units: a pixel-rounded outer box, so never smaller than the art. */
const reach = async (art, side) => {
  const pad = side * PROBE_PAD;
  const span = side + 2 * pad;
  const px = 2 * ICON_PROBE;
  const { alpha } = await raster(
    svg(`${-pad} ${-pad} ${span} ${span}`, art),
    px,
    px,
  );
  const [x0, y0, x1, y1] = alphaBox(alpha, px);
  if (x0 === 0 || y0 === 0 || x1 === px || y1 === px)
    throw new Error('The tab icon reaches its probe edge; raise PROBE_PAD.');
  const unit = span / px;
  return {
    x: x0 * unit - pad,
    y: y0 * unit - pad,
    w: (x1 - x0) * unit,
    h: (y1 - y0) * unit,
  };
};

/** A square viewBox round `art` that leaves `border` clear px in a `size` px frame. */
const framed = (art, size, border) => {
  const side = (Math.max(art.w, art.h) * size) / (size - 2 * border);
  return [art.x + art.w / 2 - side / 2, art.y + art.h / 2 - side / 2, side];
};

/** Fails the run if any pixel on a transparent frame's outer edge has alpha. */
const assertClearEdge = (alpha, size, name) => {
  const last = size - 1;
  const edge = alpha.some((a, i) => {
    const [x, y] = [i % size, Math.floor(i / size)];
    return a > 0 && (x === 0 || y === 0 || x === last || y === last);
  });
  if (edge)
    throw new Error(`${name} draws on its outer edge; raise TAB_BORDER.`);
};

const fullReach = await reach(iconFull, ICON);
const smallReach = await reach(iconSmall, ICON * FINE);

/* Whole grid units keep the viewBox short; rounded outward so the border only grows. */
const [sx, sy, sSide] = framed(smallReach, SVG_FRAME, TAB_BORDER);
const [svgX, svgY] = [Math.floor(sx), Math.floor(sy)];
const svgSide = Math.max(
  Math.ceil(sx + sSide) - svgX,
  Math.ceil(sy + sSide) - svgY,
);
const iconSvg = svg(`${svgX} ${svgY} ${svgSide} ${svgSide}`, iconSmall);
assertClearEdge(
  (await raster(iconSvg, SVG_FRAME, SVG_FRAME)).alpha,
  SVG_FRAME,
  'favicon.svg',
);
writeFileSync('public/favicon.svg', iconSvg);

const tabFrame = async (size, file) => {
  const [x, y, side] = framed(fullReach, size, TAB_BORDER);
  const { alpha, png } = await raster(
    svg(`${x} ${y} ${side} ${side}`, iconFull),
    size,
    size,
  );
  assertClearEdge(alpha, size, file);
  const frame = Buffer.from(png, 'base64');
  writeFileSync(file, frame);
  return frame;
};

/* App icons: the sticker centered on a full-bleed gold square, spanning `scale` of the 64-unit grid. */
const onGold = (scale) => {
  const side = ICON / scale;
  const x = fullReach.x + fullReach.w / 2 - side / 2;
  const y = fullReach.y + fullReach.h / 2 - side / 2;
  return svg(
    `${x} ${y} ${side} ${side}`,
    `<rect x="${x}" y="${y}" width="${side}" height="${side}" fill="${GOLD}"/>${iconFull}`,
  );
};

const frames = [16, 32, 48];
const framePngs = [];
for (const size of frames)
  framePngs.push(await tabFrame(size, `artwork/favicon-${size}x${size}.png`));
await tabFrame(96, 'public/favicon-96x96.png');
writeFileSync('public/apple-touch-icon.png', await png(onGold(APP_SCALE), 180));
writeFileSync(
  'public/android-chrome-192x192.png',
  await png(onGold(APP_SCALE), 192),
);
writeFileSync(
  'public/android-chrome-512x512.png',
  await png(onGold(APP_SCALE), 512),
);
writeFileSync(
  'public/maskable-icon-512x512.png',
  await png(onGold(MASKABLE_SCALE), 512),
);
await browser.close();

/* ICO with PNG frames: ICONDIR, one 16-byte ICONDIRENTRY per frame, then the PNGs. */
const HEADER = 6;
const ENTRY = 16;
const head = Buffer.alloc(HEADER + ENTRY * frames.length);
head.writeUInt16LE(0, 0);
head.writeUInt16LE(1, 2);
head.writeUInt16LE(frames.length, 4);
let offset = head.length;
frames.forEach((size, i) => {
  const at = HEADER + i * ENTRY;
  head.writeUInt8(size, at);
  head.writeUInt8(size, at + 1);
  head.writeUInt16LE(1, at + 4);
  head.writeUInt16LE(32, at + 6);
  head.writeUInt32LE(framePngs[i].length, at + 8);
  head.writeUInt32LE(offset, at + 12);
  offset += framePngs[i].length;
});
writeFileSync('public/favicon.ico', Buffer.concat([head, ...framePngs]));

/* The box as `--logo-rabbit-*`: offsets from the tile's padding box. */
console.log(
  JSON.stringify({
    left: box.left - BORDER,
    top: box.top - BORDER,
    width: box.width,
    height: box.height,
  }),
);
