/*
 * Draws one About cat as a jointed SVG sticker. Poses and moves are in
 * about-cats-moves.ts; AboutCats.vue owns the frame loop. Units are CSS px,
 * y down, the ground at y = 0 under the cat's origin.
 */
import type { Pose } from './about-cats-moves';

export type CatId = 'minerva' | 'hela' | 'rudra';

export type PropKind = 'toy' | 'cup' | 'post' | 'fly' | 'box' | 'yarn';

export interface PropState {
  kind: PropKind;
  x: number;
  y: number;
  r: number;
  o: number;
}

const NS = 'http://www.w3.org/2000/svg';
const D = Math.PI / 180;

/** Sticker edge and its offset shadow, as on the site's cards. */
const EDGE = 5;
const SHADOW = 3;
const LEG_W = 7.5;
const TAIL_W = 7;
const TAIL_SEGS = 8;
const TAIL_SEG = 4.2;
const UPPER = 9.5;
const LOWER = 9.5;
export const BODY_LEN = 30;
const HEAD_RX = 13;
const HEAD_RY = 11.5;
const DETAIL = 0.9;

/** Near-critical spring: the tail follows through once and settles, never swings. */
const TAIL_STIFFNESS = 0.12;
const TAIL_DAMPING = 0.62;
const PHYS_STEP_MS = 1000 / 60;
const PHYS_MAX_STEPS = 4;

const EARS = 'M-11 -4L-12 -19.5L-2 -10.5ZM2 -10.5L10.5 -19.5L11 -4Z';
const WHISKERS = 'M11 3l9 -3M11 4.4l10 0.5M11 5.8l9 3.5';
/** Where Minerva's back stripes cross the body, as fractions of its length. */
const STRIPES = [0.3, 0.5, 0.7];
/** The feather wand hangs from here, above the cat's band. */
const STRING_TOP = -100;
const WING_BEAT_MS = 16;

interface Point {
  x: number;
  y: number;
}
const pt = (x: number, y: number): Point => ({ x, y });
const f = (n: number): string => n.toFixed(2);
const clamp = (v: number, lo: number, hi: number): number =>
  Math.max(lo, Math.min(hi, v));

const el = <K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs: Record<string, string | number>,
  parent: Element,
): SVGElementTagNameMap[K] => {
  const node = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
  parent.append(node);
  return node;
};

/** Two-bone inverse kinematics; `sign` picks which way the joint bends. */
const ik = (a: Point, t: Point, sign: number): [Point, Point] => {
  const dx = t.x - a.x;
  const dy = t.y - a.y;
  const d = Math.hypot(dx, dy) || 0.001;
  const reach = clamp(d, Math.abs(UPPER - LOWER) + 0.5, UPPER + LOWER - 0.01);
  const ux = dx / d;
  const uy = dy / d;
  const bend =
    Math.acos(
      clamp(
        (UPPER * UPPER + reach * reach - LOWER * LOWER) / (2 * UPPER * reach),
        -1,
        1,
      ),
    ) * sign;
  const joint = pt(
    a.x + UPPER * (ux * Math.cos(bend) - uy * Math.sin(bend)),
    a.y + UPPER * (ux * Math.sin(bend) + uy * Math.cos(bend)),
  );
  return [joint, pt(a.x + ux * reach, a.y + uy * reach)];
};

const smoothClosed = (pts: Point[]): string => {
  const n = pts.length;
  let d = `M${f(pts[0].x)} ${f(pts[0].y)}`;
  for (let i = 0; i < n; i += 1) {
    const p0 = pts[(i - 1 + n) % n];
    const p1 = pts[i];
    const p2 = pts[(i + 1) % n];
    const p3 = pts[(i + 2) % n];
    d += `C${f(p1.x + (p2.x - p0.x) / 6)} ${f(p1.y + (p2.y - p0.y) / 6)} ${f(p2.x - (p3.x - p1.x) / 6)} ${f(p2.y - (p3.y - p1.y) / 6)} ${f(p2.x)} ${f(p2.y)}`;
  }
  return `${d}Z`;
};

interface Layer {
  group: SVGGElement;
  farLegs: [SVGPathElement, SVGPathElement];
  tail: SVGPathElement;
  body: SVGPathElement;
  haunch: SVGEllipseElement;
  legs: [SVGPathElement, SVGPathElement];
  head: SVGGElement;
  ears: SVGPathElement;
}

export interface CatRig {
  id: CatId;
  root: SVGGElement;
  flip: SVGGElement;
  layers: Layer[];
  bodyClip: SVGPathElement;
  marks: SVGGElement;
  tailMarks: SVGPathElement;
  eyesOpen: SVGGElement;
  eyesShut: SVGPathElement;
  mouth: SVGEllipseElement;
  tailAngle: number[];
  tailSpeed: number[];
  physAt: number;
  /** Head centre in the svg's coordinates, for the pointer-watcher. */
  head: Point;
}

let uid = 0;

/*
 * Colours are classes, not attributes: the stylesheet maps them to tokens per
 * cat and per theme, and the CSP refuses `style` attributes.
 */
export const createCatRig = (svg: SVGSVGElement, id: CatId): CatRig => {
  uid += 1;
  const key = `cat${uid}`;
  const defs = el('defs', {}, svg);
  const bodyClip = el('path', {}, el('clipPath', { id: `${key}-b` }, defs));
  el(
    'ellipse',
    { rx: HEAD_RX, ry: HEAD_RY },
    el('clipPath', { id: `${key}-h` }, defs),
  );
  const root = el('g', { class: 'cat-hit' }, svg);
  const flip = el('g', {}, root);

  const layer = (tone: 'shadow' | 'edge' | 'fill', extra: number): Layer => {
    const group = el(
      'g',
      tone === 'shadow'
        ? { class: 'cat-shadow', transform: `translate(${SHADOW} ${SHADOW})` }
        : { class: tone === 'edge' ? 'cat-edge' : 'cat-fill' },
      flip,
    );
    const stroke = (width: number, part: string): SVGPathElement =>
      el(
        'path',
        {
          class: `cat-line-${part}`,
          'stroke-width': width + extra,
          'stroke-linecap': 'round',
          'stroke-linejoin': 'round',
        },
        group,
      );
    const solid = (part: string): Record<string, string | number> => ({
      class: `cat-solid-${part}`,
      'stroke-width': extra,
      'stroke-linejoin': 'round',
    });
    const farLegs: [SVGPathElement, SVGPathElement] = [
      stroke(LEG_W, 'far'),
      stroke(LEG_W, 'far'),
    ];
    const tail = stroke(TAIL_W, id === 'hela' ? 'patch' : 'fur');
    const body = el('path', solid('fur'), group);
    const haunch = el('ellipse', solid('fur'), group);
    const legs: [SVGPathElement, SVGPathElement] = [
      stroke(LEG_W, 'fur'),
      stroke(LEG_W, 'fur'),
    ];
    const head = el('g', {}, group);
    const ears = el('path', { d: EARS, ...solid('fur') }, head);
    el('ellipse', { rx: HEAD_RX, ry: HEAD_RY, ...solid('fur') }, head);
    return { group, farLegs, tail, body, haunch, legs, head, ears };
  };

  const layers = [layer('shadow', EDGE), layer('edge', EDGE), layer('fill', 0)];
  const top = layers[2];

  const marks = el('g', { 'clip-path': `url(#${key}-b)` }, top.group);
  top.group.insertBefore(marks, top.haunch);
  const tailMarks = el(
    'path',
    {
      class: 'cat-line-mark',
      'stroke-width': TAIL_W,
      'stroke-dasharray': id === 'hela' ? '4 5' : '3 4',
    },
    top.group,
  );
  top.group.insertBefore(tailMarks, top.body);

  const headMarks = el('g', { 'clip-path': `url(#${key}-h)` }, top.head);
  if (id === 'minerva') {
    el(
      'path',
      {
        d: 'M-4 -10l1.5 -4M0 -11v-4',
        class: 'cat-line-mark',
        'stroke-width': 2.2,
        'stroke-linecap': 'round',
      },
      headMarks,
    );
  }
  if (id === 'hela')
    el('circle', { cx: 6, cy: -8, r: 7, class: 'cat-solid-mark' }, headMarks);

  const eyeRadius = id === 'rudra' ? 2.3 : 1.8;
  const eyesOpen = el('g', {}, top.head);
  el(
    'circle',
    { cx: -1, cy: -1, r: eyeRadius, class: 'cat-solid-eye' },
    eyesOpen,
  );
  el(
    'circle',
    { cx: 7, cy: -1.5, r: eyeRadius, class: 'cat-solid-eye' },
    eyesOpen,
  );
  const eyesShut = el(
    'path',
    {
      d: 'M-3 -1q2 1.8 4 0M5 -1.5q2 1.8 4 0',
      class: 'cat-line-lid',
      'stroke-width': 1.1,
      'stroke-linecap': 'round',
    },
    top.head,
  );
  const mouth = el(
    'ellipse',
    { cx: 9, cy: 5, rx: 2.3, ry: 0, class: 'cat-solid-mouth' },
    top.head,
  );
  el(
    'path',
    {
      d: WHISKERS,
      class: 'cat-line-whisker',
      'stroke-width': DETAIL,
      'stroke-linecap': 'round',
    },
    top.head,
  );

  return {
    id,
    root,
    flip,
    layers,
    bodyClip,
    marks,
    tailMarks,
    eyesOpen,
    eyesShut,
    mouth,
    tailAngle: [],
    tailSpeed: [],
    physAt: 0,
    head: pt(0, 0),
  };
};

const stepTail = (rig: CatRig, targets: number[], now: number): void => {
  if (rig.tailAngle.length === 0) {
    rig.tailAngle = [...targets];
    rig.tailSpeed = targets.map(() => 0);
    rig.physAt = now;
    return;
  }
  let steps = Math.min(
    PHYS_MAX_STEPS,
    Math.floor((now - rig.physAt) / PHYS_STEP_MS),
  );
  rig.physAt += steps * PHYS_STEP_MS;
  if (now - rig.physAt > PHYS_STEP_MS * PHYS_MAX_STEPS) rig.physAt = now;
  while (steps > 0) {
    steps -= 1;
    for (let i = 0; i < TAIL_SEGS; i += 1) {
      const want =
        i === 0
          ? targets[0]
          : rig.tailAngle[i - 1] + (targets[i] - targets[i - 1]);
      rig.tailSpeed[i] +=
        (want - rig.tailAngle[i]) * TAIL_STIFFNESS -
        rig.tailSpeed[i] * TAIL_DAMPING;
      rig.tailAngle[i] += rig.tailSpeed[i];
    }
  }
};

/** Resets the tail so a jump cut (resize, reduced motion) does not swing it. */
export const settleTail = (rig: CatRig): void => {
  rig.tailAngle = [];
};

interface Skeleton {
  centre: Point;
  length: number;
  half: number;
  hip: Point;
  shoulder: Point;
  head: Point;
  at: (u: number, v: number) => Point;
}

const skeleton = (p: Pose): Skeleton => {
  const b = p.ba * D;
  const along = pt(Math.cos(b), -Math.sin(b));
  const up = pt(-Math.sin(b), -Math.cos(b));
  const centre = pt(0, -p.by - p.y);
  const length = BODY_LEN * (2 - p.sq);
  const half = (p.bt * p.sq) / 2;
  const hip = pt(
    centre.x - (along.x * length) / 2,
    centre.y - (along.y * length) / 2,
  );
  const shoulder = pt(
    centre.x + (along.x * length) / 2,
    centre.y + (along.y * length) / 2,
  );
  const at = (u: number, v: number): Point =>
    pt(hip.x + along.x * u + up.x * v, hip.y + along.y * u + up.y * v);
  return {
    centre,
    length,
    half,
    hip,
    shoulder,
    head: pt(shoulder.x + p.hx, shoulder.y + p.hy),
    at,
  };
};

const tailTargets = (p: Pose, seconds: number): number[] =>
  Array.from(
    { length: TAIL_SEGS },
    (_, i) =>
      p.ta -
      p.ba +
      p.tc * i +
      p.tw * Math.sin(seconds * 9 - i * 0.8) * Math.max(0, (i - 4) / 3),
  );

const rotateAbout = (q: Point, c: Point, degrees: number): Point => {
  const a = degrees * D;
  const dx = q.x - c.x;
  const dy = q.y - c.y;
  return pt(
    c.x + dx * Math.cos(a) - dy * Math.sin(a),
    c.y + dx * Math.sin(a) + dy * Math.cos(a),
  );
};

/*
 * Height of a pose's highest drawn point above the ground, edge included.
 * The tail is taken straight at its targets; the spring only lags behind them.
 */
export const highestPoint = (p: Pose): number => {
  const { centre, half, at, length, head } = skeleton(p);
  const headPoint = (q: Point): Point => {
    const turned = rotateAbout(q, pt(0, 0), p.hr);
    return pt(head.x + turned.x, head.y + turned.y);
  };
  const ears = [pt(-12, -19.5), pt(10.5, -19.5)].map((tip) =>
    rotateAbout(tip, pt(0, -8), -30 * p.ears),
  );
  const points: Point[] = [
    at(length * 0.5, half * 1.05),
    at(-2, half),
    at(length + 2, half * 0.95),
    headPoint(pt(0, -HEAD_RY)),
    ...ears.map(headPoint),
    ...(['fN', 'fF', 'hN', 'hF'] as const).map((k) =>
      pt(centre.x + p[k][0], centre.y + p[k][1]),
    ),
  ];
  let q = at(-4, 0);
  for (const angle of tailTargets(p, 0)) {
    q = pt(
      q.x + TAIL_SEG * Math.cos(angle * D),
      q.y + TAIL_SEG * Math.sin(angle * D),
    );
    points.push(q);
  }
  const top = Math.min(
    ...points.map((point) => rotateAbout(point, centre, p.rot).y),
  );
  return -top + EDGE + LEG_W / 2;
};

export const renderCat = (
  rig: CatRig,
  p: Pose,
  now: number,
  x: number,
  groundY: number,
): void => {
  const { centre, length, half, hip, shoulder, head, at } = skeleton(p);
  const body = smoothClosed([
    at(-6, half * 0.2),
    at(-2, half),
    at(length * 0.5, half * 1.05),
    at(length + 2, half * 0.95),
    at(length + 7, 0),
    at(length + 3, -half * 0.95),
    at(length * 0.5, -half),
    at(-2, -half * 0.95),
    at(-6.5, -half * 0.3),
  ]);
  rig.bodyClip.setAttribute('d', body);

  const paw = (k: 'fN' | 'fF' | 'hN' | 'hF'): Point =>
    pt(centre.x + p[k][0], centre.y + p[k][1]);
  const leg = (
    from: Point,
    k: 'fN' | 'fF' | 'hN' | 'hF',
    sign: number,
  ): string => {
    const [joint, end] = ik(from, paw(k), sign);
    return `M${f(from.x)} ${f(from.y)}L${f(joint.x)} ${f(joint.y)}L${f(end.x)} ${f(end.y)}`;
  };
  const front = at(length - 3, -half * 0.3);
  const hind = at(3, -half * 0.3);
  const legs = {
    fN: leg(front, 'fN', 1),
    fF: leg(pt(front.x - 3, front.y), 'fF', 1),
    hN: leg(hind, 'hN', -1),
    hF: leg(pt(hind.x + 3, hind.y), 'hF', -1),
  };

  const targets = tailTargets(p, now / 1000);
  stepTail(rig, targets, now);
  const tp: Point[] = [at(-4, 0)];
  for (let i = 0; i < TAIL_SEGS; i += 1) {
    const a = rig.tailAngle[i] * D;
    const q = tp[i];
    tp.push(
      pt(
        q.x + TAIL_SEG * Math.cos(a),
        Math.min(q.y + TAIL_SEG * Math.sin(a), -TAIL_W / 2),
      ),
    );
  }
  let tail = `M${f(tp[0].x)} ${f(tp[0].y)}`;
  for (let i = 1; i < tp.length - 1; i += 1) {
    tail += `Q${f(tp[i].x)} ${f(tp[i].y)} ${f((tp[i].x + tp[i + 1].x) / 2)} ${f((tp[i].y + tp[i + 1].y) / 2)}`;
  }
  tail += `L${f(tp[tp.length - 1].x)} ${f(tp[tp.length - 1].y)}`;

  const haunch = pt(
    hip.x + (shoulder.x - hip.x) * 0.1,
    hip.y + (shoulder.y - hip.y) * 0.1 + 2,
  );
  const haunchR = Math.max(0.01, p.haunch);

  for (const layer of rig.layers) {
    layer.body.setAttribute('d', body);
    layer.farLegs[0].setAttribute('d', legs.fF);
    layer.farLegs[1].setAttribute('d', legs.hF);
    layer.legs[0].setAttribute('d', legs.hN);
    layer.legs[1].setAttribute('d', legs.fN);
    layer.tail.setAttribute('d', tail);
    layer.haunch.setAttribute('cx', f(haunch.x));
    layer.haunch.setAttribute('cy', f(haunch.y));
    layer.haunch.setAttribute('rx', f(haunchR));
    layer.haunch.setAttribute('ry', f(haunchR * 1.05));
    layer.head.setAttribute(
      'transform',
      `translate(${f(head.x)} ${f(head.y)}) rotate(${f(p.hr)})`,
    );
    layer.ears.setAttribute('transform', `rotate(${f(-30 * p.ears)} 0 -8)`);
  }
  rig.tailMarks.setAttribute('d', tail);

  rig.marks.replaceChildren();
  if (rig.id === 'minerva') {
    for (const k of STRIPES) {
      const a = at(length * k, -half - 2);
      const z = at(length * k - 1, -half + 8);
      el(
        'path',
        {
          d: `M${f(a.x)} ${f(a.y)}L${f(z.x)} ${f(z.y)}`,
          class: 'cat-line-mark',
          'stroke-width': 2.4,
          'stroke-linecap': 'round',
        },
        rig.marks,
      );
    }
  } else if (rig.id === 'hela') {
    const o = at(length * 0.35, -half * 0.35);
    el(
      'ellipse',
      { cx: f(o.x), cy: f(o.y), rx: 9, ry: 6.5, class: 'cat-solid-patch' },
      rig.marks,
    );
  }

  const open = p.eyes > 0.5;
  rig.eyesOpen.setAttribute('visibility', open ? 'visible' : 'hidden');
  rig.eyesShut.setAttribute('visibility', open ? 'hidden' : 'visible');
  rig.mouth.setAttribute('ry', f(3 * p.mouth));

  rig.root.setAttribute('transform', `translate(${f(x)} ${f(groundY)})`);
  rig.flip.setAttribute(
    'transform',
    `scale(${f(p.face)} 1) rotate(${f(p.rot)} 0 ${f(centre.y)})`,
  );
  rig.head = pt(x + p.face * head.x, groundY + head.y);
};

export interface PropRig {
  node: SVGGElement;
  draw: (state: PropState, now: number) => void;
}

/* Props share the cat classes, so they follow the theme too. */
export const createProp = (parent: SVGGElement, kind: PropKind): PropRig => {
  const node = el('g', { class: 'cat-prop' }, parent);
  const edge = {
    class: 'cat-prop-solid',
    'stroke-width': 1.8,
    'stroke-linejoin': 'round',
  };
  if (kind === 'toy') {
    const line = el(
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
    el(
      'circle',
      { r: 4.2, ...edge, class: 'cat-prop-solid cat-prop-toy' },
      pom,
    );
    return {
      node,
      draw: (s) => {
        const px = s.x + (s.y - STRING_TOP) * Math.sin(s.r * D);
        const py = STRING_TOP + (s.y - STRING_TOP) * Math.cos(s.r * D);
        line.setAttribute('d', `M${f(s.x)} ${STRING_TOP}L${f(px)} ${f(py)}`);
        pom.setAttribute('transform', `translate(${f(px)} ${f(py)})`);
        node.setAttribute('opacity', f(s.o));
      },
    };
  }
  if (kind === 'fly') {
    const wings = [
      el(
        'ellipse',
        { cx: -2.2, cy: -2.5, rx: 3, ry: 1.4, class: 'cat-prop-wing' },
        node,
      ),
      el(
        'ellipse',
        { cx: 2.2, cy: -2.5, rx: 3, ry: 1.4, class: 'cat-prop-wing' },
        node,
      ),
    ];
    el('ellipse', { rx: 2.2, ry: 1.6, class: 'cat-prop-body' }, node);
    return {
      node,
      draw: (s, now) => {
        node.setAttribute('transform', `translate(${f(s.x)} ${f(s.y)})`);
        node.setAttribute('opacity', f(s.o));
        wings.forEach((w, i) =>
          w.setAttribute(
            'ry',
            f(0.4 + 1.3 * Math.abs(Math.sin(now / WING_BEAT_MS + i))),
          ),
        );
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
    el(
      'path',
      {
        d: 'M-5.5 -12h11l-1 12h-9z',
        ...edge,
        class: 'cat-prop-solid cat-prop-cup',
      },
      node,
    );
  } else if (kind === 'post') {
    el(
      'rect',
      {
        x: -5,
        y: -58,
        width: 10,
        height: 58,
        ...edge,
        class: 'cat-prop-solid cat-prop-card',
      },
      node,
    );
    el(
      'path',
      {
        d: 'M-5 -50l10 3M-5 -42l10 3M-5 -34l10 3M-5 -26l10 3M-5 -18l10 3M-5 -10l10 3',
        class: 'cat-prop-rope',
        'stroke-width': 1.3,
      },
      node,
    );
    el(
      'rect',
      {
        x: -10,
        y: -62,
        width: 20,
        height: 5,
        ...edge,
        class: 'cat-prop-solid cat-prop-card',
      },
      node,
    );
  } else if (kind === 'box') {
    el(
      'path',
      {
        d: 'M-30 -22l-8 -9M30 -22l8 -9',
        class: 'cat-prop-string',
        'stroke-width': 3,
        'stroke-linecap': 'round',
      },
      node,
    );
    el(
      'rect',
      {
        x: -30,
        y: -22,
        width: 60,
        height: 22,
        ...edge,
        class: 'cat-prop-solid cat-prop-card',
      },
      node,
    );
  } else {
    el(
      'path',
      { d: 'M4 4q9 5 16 3', class: 'cat-prop-yarn-end', 'stroke-width': 1.5 },
      node,
    );
    el('circle', { r: 6, ...edge, class: 'cat-prop-solid cat-prop-toy' }, node);
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
    draw: (s) => {
      node.setAttribute(
        'transform',
        `translate(${f(s.x)} ${f(s.y)}) rotate(${f(s.r)})`,
      );
      node.setAttribute('opacity', f(s.o));
    },
  };
};
