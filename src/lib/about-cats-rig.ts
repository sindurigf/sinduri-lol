/*
 * Draws one About cat from its frames, die-cut stickers packed in one sheet per
 * cat (scripts/make-about-cats.mjs), and the toys it plays with. Poses and
 * moves are in about-cats-moves.ts; AboutCats.vue owns the frame loop. Units
 * are CSS px, y down, the ground at y = 0 under the cat's origin.
 */
import { PAD, SHEET } from './about-cats-sheet';
import {
  POSE_FRAME,
  frameFor,
  type Frame,
  type Motion,
  type NamedPose,
} from './about-cats-frames';
import { pose } from './about-cats-moves';
import type { CatId, Pose, PropKind, PropState } from './about-cats-types';

const NS = 'http://www.w3.org/2000/svg';
const D = Math.PI / 180;

/** How long a new frame takes to fade in over the last one. */
const FADE_MS = 110;
/** ms a frame must have shown before the next one fades in over it, not cuts. */
const HELD_MS = 240;
/** px a cat must move in a frame to read as walking, not shuffling. */
const WALKING = 0.15;
/** The white rim and ink edge round each frame, in px: part of the drawing. */
const OUTLINE = 3;
/** The feather's string hangs from just under the band's top: --spacing-cat-band (140px) must stay above it. */
const STRING_TOP = -136;
/** The scratching post's height in px, cap aside; with it, it stays under the band. */
export const POST_HEIGHT = 92;
/** Where each turn of rope starts on the post's left edge, top to bottom, in px. */
const ROPE_TURNS = [-86, -78, -70, -62, -54, -46, -38, -30, -22, -14];
/** A small and a larger "z", drawn from the lower left of the small one. */
const ZZ = 'M0 0h4l-4 5h4M6 -9h6l-6 7h6';
const ZZ_HEIGHT = 14;
const ZZ_WIDTH = 12;
/** How far the "z" sits past the sleeping cat's head, and how far it rises to get there. */
const ZZ_AHEAD = 6;
const ZZ_RISE = 10;
/** Half the click box's least width: over 44px (SC 2.5.5), wider for a wider frame. */
export const HIT_HALF_WIDTH = 48;
const WING_BEAT_MS = 16;

const f = (n: number): string => n.toFixed(2);
export const clamp = (v: number, lo: number, hi: number): number =>
  Math.max(lo, Math.min(hi, v));

type Attrs = Record<string, string | number>;

const set = (node: Element, name: string, value: string | number): void => {
  node.setAttribute(name, String(value));
};
const translate = (x: number, y: number): string =>
  `translate(${f(x)} ${f(y)})`;

const el = <K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs: Attrs,
  parent: Element,
): SVGElementTagNameMap[K] => {
  const node = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) set(node, k, v);
  parent.append(node);
  return node;
};

/** A round-capped stroke in one of the cat's line colors. */
const line = (part: string, width: number): Attrs => ({
  class: `cat-line-${part}`,
  'stroke-width': width,
  'stroke-linecap': 'round',
});

const NAMED = Object.fromEntries(
  (Object.keys(POSE_FRAME) as NamedPose[]).map((name) => [name, pose(name)]),
) as Record<NamedPose, Pose>;

const STILL: Motion = { travelled: 0, moving: false, lift: 0, lastLift: 0 };

/** A frame's drawn size and the cat's own size inside it, in px. */
const sizeOf = (id: CatId, frame: Frame) => {
  const [, , , , dw, dh, w, h] = SHEET[id][frame];
  return { dw, dh, w, h };
};

/** The frame a pose is drawn as, standing still. */
export const stillFrame = (p: Pose): Frame =>
  frameFor(p, NAMED, { ...STILL, lift: p.y, lastLift: p.y });

const CAT_IDS = Object.keys(SHEET) as CatId[];

/** Height of a pose's highest drawn point above the ground, outline included, for the tallest cat. */
export const highestPoint = (p: Pose): number => {
  const frame = stillFrame(p);
  return (
    Math.max(...CAT_IDS.map((id) => sizeOf(id, frame).h)) +
    OUTLINE +
    Math.max(0, p.y) +
    (p.zz > 0 ? ZZ_HEIGHT : 0)
  );
};

/** How far a pose's drawing reaches left and right of its origin, outline included, for the widest cat. */
export const reachOf = (p: Pose): [number, number] => {
  const half =
    Math.max(...CAT_IDS.map((id) => sizeOf(id, stillFrame(p)).w)) / 2 + OUTLINE;
  const zz = p.zz > 0 ? ZZ_AHEAD + ZZ_WIDTH : 0;
  return p.face < 0 ? [-half - zz, half] : [-half, half + zz];
};

/** One frame of the sheet, shown through a window cut to its size. */
interface Layer {
  view: SVGSVGElement;
  image: SVGImageElement;
}

/** A cat's frame sheet as imported: its URL and size in px. */
export interface Sheet {
  src: string;
  width: number;
  height: number;
}

export interface CatRig {
  id: CatId;
  sheet: Sheet;
  /** Behind the cat, and over it (a box's front). */
  props: SVGGElement;
  propsFront: SVGGElement;
  root: SVGGElement;
  hit: SVGRectElement;
  zz: SVGPathElement;
  flip: SVGGElement;
  /** The frame fading out, then the one fading in. */
  layers: [Layer, Layer];
  frame: Frame | null;
  changedAt: number;
  shownAt: number;
  lastX: number;
  lastLift: number;
  travelled: number;
  /** Head center in the svg's coordinates, for the pointer-watcher. */
  head: { x: number; y: number };
}

export const createCatRig = (
  svg: SVGSVGElement,
  id: CatId,
  sheet: Sheet,
): CatRig => {
  /* Props behind the cat, then the cat, then props in front of it. */
  const props = el('g', {}, svg);
  const root = el('g', { class: 'cat-hit' }, svg);
  const hit = el('rect', { class: 'cat-hit-area' }, root);
  const flip = el('g', {}, root);
  const layer = (): Layer => {
    const view = el(
      'svg',
      { overflow: 'hidden', 'aria-hidden': 'true', focusable: 'false' },
      flip,
    );
    const image = el('image', { href: sheet.src }, view);
    return { view, image };
  };
  const layers: [Layer, Layer] = [layer(), layer()];
  /* Outside the flip, so the letter never reads backwards. */
  const zz = el(
    'path',
    {
      d: ZZ,
      ...line('z', 1.6),
      'stroke-linejoin': 'round',
      visibility: 'hidden',
    },
    root,
  );
  const propsFront = el('g', {}, svg);
  return {
    id,
    sheet,
    props,
    propsFront,
    root,
    hit,
    zz,
    flip,
    layers,
    frame: null,
    changedAt: -Infinity,
    shownAt: -Infinity,
    lastX: NaN,
    lastLift: 0,
    travelled: 0,
    head: { x: 0, y: 0 },
  };
};

/** Shows `frame` in `layer`, its ground line at y = 0 and centered on x = 0. */
const drawFrame = (rig: CatRig, layer: Layer, frame: Frame): void => {
  const [sx, sy, sw, sh, dw, dh, , h] = SHEET[rig.id][frame];
  const { width, height } = rig.sheet;
  set(layer.view, 'x', f(-dw / 2));
  set(layer.view, 'y', f(-(PAD + h)));
  set(layer.view, 'width', dw);
  set(layer.view, 'height', dh);
  set(layer.view, 'viewBox', `${sx} ${sy} ${sw} ${sh}`);
  set(layer.image, 'width', width);
  set(layer.image, 'height', height);
};

export const isFading = (
  rig: Pick<CatRig, 'changedAt'>,
  now: number,
): boolean => now - rig.changedAt < FADE_MS;

/** Ends any fade, so a jump cut (resize, reduced motion) shows the new frame at once. */
export const settleFrame = (rig: CatRig): void => {
  rig.changedAt = -Infinity;
};

export const renderCat = (
  rig: CatRig,
  p: Pose,
  now: number,
  x: number,
  groundY: number,
): void => {
  const step = Number.isNaN(rig.lastX) ? 0 : Math.abs(x - rig.lastX);
  rig.lastX = x;
  const moving = step > WALKING;
  rig.travelled = moving ? rig.travelled + step : 0;
  const frame = frameFor(p, NAMED, {
    travelled: rig.travelled,
    moving,
    lift: p.y,
    lastLift: rig.lastLift,
  });
  rig.lastLift = p.y;

  const [back, front] = rig.layers;
  if (frame !== rig.frame) {
    if (rig.frame) drawFrame(rig, back, rig.frame);
    drawFrame(rig, front, frame);
    /* Only a frame that held still fades out: faded mid-stride or mid-leap, the legs double. */
    const fades = rig.frame !== null && now - rig.shownAt > HELD_MS && p.y <= 0;
    rig.shownAt = now;
    rig.changedAt = fades ? now : -Infinity;
    rig.frame = frame;
    set(rig.root, 'data-frame', frame);
  }
  const k = clamp((now - rig.changedAt) / FADE_MS, 0, 1);
  set(front.view, 'opacity', f(k));
  set(back.view, 'opacity', f(1 - k));

  const { w, h } = sizeOf(rig.id, frame);
  const half = Math.max(HIT_HALF_WIDTH, w / 2 + OUTLINE);
  set(rig.hit, 'x', f(-half));
  set(rig.hit, 'width', f(2 * half));
  const lift = Math.max(0, p.y);
  set(rig.hit, 'y', f(-(h + OUTLINE + lift)));
  set(rig.hit, 'height', f(h + OUTLINE + lift));

  const sleeping = p.zz > 0;
  set(rig.zz, 'visibility', sleeping ? 'visible' : 'hidden');
  if (sleeping) {
    const zx = p.face * (w / 2 + ZZ_AHEAD) - (p.face < 0 ? ZZ_WIDTH : 0);
    set(rig.zz, 'transform', translate(zx, -h + ZZ_RISE * (1 - p.zz)));
    set(rig.zz, 'opacity', f(Math.min(1, 2 * p.zz)));
  }

  set(rig.root, 'transform', translate(x, groundY));
  /* The drawings face left; a squash flattens the cat onto its feet. */
  set(
    rig.flip,
    'transform',
    `translate(0 ${f(-lift)}) scale(${f(-p.face * (2 - p.sq))} ${f(p.sq)})`,
  );
  rig.head = { x: x + (p.face * w) / 3, y: groundY - lift - h * 0.8 };
};

export interface PropRig {
  node: SVGGElement;
  draw: (state: PropState, now: number) => void;
  remove: () => void;
}

/* Props share the cat classes, so they follow the theme too. */
/* `front` is drawn over the cat: the yarn ball held in its paws. */
export const createProp = (
  parent: SVGGElement,
  front: SVGGElement,
  kind: PropKind,
): PropRig => {
  /* The yarn ball is held in the paws, so it draws over the cat. */
  const node = el('g', { class: 'cat-prop' }, kind === 'yarn' ? front : parent);
  const remove = (): void => {
    node.remove();
  };
  const solid = (part: string): Attrs => ({
    class: `cat-prop-solid cat-prop-${part}`,
    'stroke-width': 1.8,
    'stroke-linejoin': 'round',
  });
  if (kind === 'toy') {
    const string = el(
      'path',
      { class: 'cat-prop-string', 'stroke-width': 1.2 },
      node,
    );
    const pom = el('g', {}, node);
    el(
      'path',
      {
        d: 'M0 0q-5 4 -6 11M0 0q0 6 1 12M0 0q5 3 6 10',
        class: 'cat-prop-feather',
        'stroke-width': 2.2,
        'stroke-linecap': 'round',
      },
      pom,
    );
    el('circle', { r: 4.2, ...solid('toy') }, pom);
    return {
      node,
      remove,
      draw: (s) => {
        const px = s.x + (s.y - STRING_TOP) * Math.sin(s.r * D);
        const py = STRING_TOP + (s.y - STRING_TOP) * Math.cos(s.r * D);
        set(string, 'd', `M${f(s.x)} ${STRING_TOP}L${f(px)} ${f(py)}`);
        set(pom, 'transform', translate(px, py));
        set(node, 'opacity', f(s.o));
      },
    };
  }
  if (kind === 'fly') {
    const wings = [-2.2, 2.2].map((cx) =>
      el(
        'ellipse',
        { cx, cy: -2.5, rx: 3, ry: 1.4, class: 'cat-prop-wing' },
        node,
      ),
    );
    el('ellipse', { rx: 2.2, ry: 1.6, class: 'cat-prop-body' }, node);
    return {
      node,
      remove,
      draw: (s, now) => {
        set(node, 'transform', translate(s.x, s.y));
        set(node, 'opacity', f(s.o));
        wings.forEach((w, i) => {
          set(
            w,
            'ry',
            f(0.4 + 1.3 * Math.abs(Math.sin(now / WING_BEAT_MS + i))),
          );
        });
      },
    };
  }
  if (kind === 'cup') {
    el(
      'path',
      {
        d: 'M5 -9a4 4 0 0 1 0 6.5',
        class: 'cat-prop-string',
        'stroke-width': 2,
      },
      node,
    );
    el('path', { d: 'M-5.5 -12h11l-1 12h-9z', ...solid('cup') }, node);
  } else if (kind === 'post') {
    el(
      'rect',
      {
        x: -5,
        y: -POST_HEIGHT,
        width: 10,
        height: POST_HEIGHT,
        ...solid('card'),
      },
      node,
    );
    el(
      'path',
      {
        d: ROPE_TURNS.map((y) => `M-5 ${y}l10 3`).join(''),
        class: 'cat-prop-rope',
        'stroke-width': 1.3,
      },
      node,
    );
    el(
      'rect',
      {
        x: -10,
        y: -POST_HEIGHT - 4,
        width: 20,
        height: 5,
        ...solid('card'),
      },
      node,
    );
  } else {
    el(
      'path',
      { d: 'M4 4q9 5 16 3', class: 'cat-prop-yarn-end', 'stroke-width': 1.5 },
      node,
    );
    el('circle', { r: 6, ...solid('toy') }, node);
    el(
      'path',
      {
        d: 'M-4 -3.5q4 3 8 0M-5 0.5q5 3 10 0M-2 -5q2.5 5 0 10',
        class: 'cat-prop-rope',
        'stroke-width': 1.1,
      },
      node,
    );
  }
  return {
    node,
    remove,
    draw: (s) => {
      set(node, 'transform', `${translate(s.x, s.y)} rotate(${f(s.r)})`);
      set(node, 'opacity', f(s.o));
    },
  };
};
