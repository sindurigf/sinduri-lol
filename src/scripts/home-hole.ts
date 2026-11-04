/*
 * The rabbit hole, cut away: a brick shaft drops from the mouth through the
 * ledge and on below the hero, with uneven, chipped and missing bricks, bites
 * torn out of the ledge beside it, and the ground's bricks fading out around
 * its foot. The wall toward the first heading ends above the floor, so the
 * rabbit can hop out (home-faller.ts). Drawn once per size; no motion.
 */

const SVG = 'http://www.w3.org/2000/svg';
/* Drawing sizes in px: wall thickness, course height, ground brick length, and how far the shaft runs below the hero. */
const PHONE = { wall: 14, course: 12, brick: 44, below: 110, groundBricks: 2 };
const WIDE = { wall: 24, course: 18, brick: 76, below: 170, groundBricks: 3 };
const PHONE_LEDGE_PX = 30;
/* Share of a wall's thickness its inner face wanders, and the odds a corner is chipped or a course missing. */
const JAG = 0.45;
const CHIP = 0.5;
const GONE = 0.12;
/* How much of a ground brick's length and the ledge's height a torn bite takes. */
const BITE_REACH = 0.62;
const BITE_DEPTH = 0.62;
const PEBBLES = 4;
/* The back wall's top course is this share light, each course lower this much darker. */
const BACK_LIGHT = 50;
const BACK_STEP = 6;
/* Head room the rabbit needs above its floor before the exit-side wall may resume. */
const EXIT_ROOM = { phone: 80, wide: 96 };
const SEED = 6571;

const seeded = (seed: number): (() => number) => {
  let state = seed;
  return () => {
    state = (state * 16807) % 2147483647;
    return state / 2147483647;
  };
};

type Point = readonly [number, number];

const svg = <K extends keyof SVGElementTagNameMap>(
  name: K,
  attributes: Record<string, string | number>,
  style: Record<string, string> = {},
  children: SVGElement[] = [],
): SVGElementTagNameMap[K] => {
  const element = document.createElementNS(SVG, name);
  for (const [key, value] of Object.entries(attributes))
    element.setAttribute(key, String(value));
  for (const [key, value] of Object.entries(style))
    element.style.setProperty(key, value);
  element.append(...children);
  return element;
};

const points = (list: readonly Point[]): string =>
  list.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');

export const createHole = ({
  band,
  mouth,
}: {
  band: HTMLElement;
  mouth: HTMLElement;
}): void => {
  const hero = band.offsetParent;
  if (!(hero instanceof HTMLElement)) return;
  const ink = 'var(--color-block-ink)';
  const light = 'var(--color-block-light)';
  const mix = (share: number): string =>
    `color-mix(in srgb, ${light} ${Math.max(0, Math.min(100, share)).toFixed(0)}%, ${ink})`;
  const edge =
    parseFloat(getComputedStyle(band).getPropertyValue('--block-edge')) || 4;
  let layers: Element[] = [];
  let drawnFor = -1;

  const draw = (): void => {
    layers.forEach((layer) => layer.remove());
    layers = [];
    const random = seeded(SEED);
    const b = band.getBoundingClientRect();
    const m = mouth.getBoundingClientRect();
    const bandWidth = b.width;
    const bandHeight = b.height;
    const ledge =
      parseFloat(getComputedStyle(band).getPropertyValue('--ledge-h')) || 0;
    const phone = ledge < PHONE_LEDGE_PX;
    const size = phone ? PHONE : WIDE;
    const ground = bandHeight - ledge;
    const heroEdge = parseFloat(getComputedStyle(hero).borderBottomWidth) || 0;
    const bottom = bandHeight + heroEdge + size.below;
    const xL = m.left - b.left;
    const xR = m.right - b.left;
    const t = size.wall;
    const ch = size.course;
    const first = document
      .querySelector('.home-fall > .band h2')
      ?.getBoundingClientRect();
    const center = (xL + xR) / 2;
    const exitSide = first ? (first.right - b.left < center ? -1 : 1) : 0;
    const openFrom = first
      ? first.top - b.top - (phone ? EXIT_ROOM.phone : EXIT_ROOM.wide)
      : Number.POSITIVE_INFINITY;

    const chip = (w: number, h: number): number =>
      random() < CHIP ? Math.min(w, h) * (0.25 + random() * 0.35) : 0;
    const brick = (
      x: number,
      y: number,
      w: number,
      h: number,
      fill: string,
      line = edge * 0.75,
    ): SVGPolygonElement => {
      const [a, c, d, e] = [chip(w, h), chip(w, h), chip(w, h), chip(w, h)];
      return svg(
        'polygon',
        {
          points: points([
            [x + a, y],
            [x + w - c, y],
            [x + w, y + c],
            [x + w, y + h - d],
            [x + w - d, y + h],
            [x + e, y + h],
            [x, y + h - e],
            [x, y + a],
          ]),
        },
        {
          fill,
          stroke: ink,
          'stroke-width': `${line}px`,
          'stroke-linejoin': 'round',
        },
      );
    };
    const jagged = (
      from: Point,
      to: Point,
      kinks: number,
      amp: number,
    ): Point[] => {
      const [x0, y0] = from;
      const [dx, dy] = [to[0] - x0, to[1] - y0];
      const length = Math.hypot(dx, dy) || 1;
      const out: Point[] = [from];
      for (let i = 1; i < kinks; i += 1) {
        const s = i / kinks + ((random() - 0.5) * 0.4) / kinks;
        const o = (random() - 0.5) * 2 * amp;
        out.push([
          x0 + dx * s - (dy / length) * o,
          y0 + dy * s + (dx / length) * o,
        ]);
      }
      out.push(to);
      return out;
    };
    const stop = (
      offset: number,
      opacity: number,
      color = ink,
    ): SVGStopElement =>
      svg(
        'stop',
        { offset },
        { 'stop-color': color, 'stop-opacity': String(opacity) },
      );
    const id = (name: string): string => `home-hole-${name}`;
    const fade = (
      name: string,
      top: number,
      stops: [number, number, number, number],
    ): SVGElement[] => [
      svg(
        'linearGradient',
        {
          id: id(`${name}-ramp`),
          gradientUnits: 'userSpaceOnUse',
          x1: 0,
          y1: top,
          x2: 0,
          y2: bottom,
        },
        {},
        [stop(stops[0], stops[1]), stop(stops[2], stops[3])],
      ),
      svg(
        'mask',
        {
          id: id(name),
          maskUnits: 'userSpaceOnUse',
          x: -bandWidth,
          y: top,
          width: bandWidth * 3,
          height: bottom - top,
        },
        { 'mask-type': 'alpha' },
        [
          svg('rect', {
            x: -bandWidth,
            y: top,
            width: bandWidth * 3,
            height: bottom - top,
            fill: `url(#${id(`${name}-ramp`)})`,
          }),
        ],
      ),
    ];

    /* Back wall: courses lit at the top and darkening down, joints that wander, the left side in the lip's shadow. */
    const back: SVGElement[] = [
      svg(
        'rect',
        {
          x: xL - t,
          y: ground,
          width: xR - xL + 2 * t,
          height: bottom - ground,
        },
        { fill: ink },
      ),
    ];
    for (let y = ground, r = 0; y < bottom; y += ch, r += 1) {
      const share = BACK_LIGHT - r * BACK_STEP;
      if (share <= 0) break;
      back.push(
        svg(
          'rect',
          { x: xL, y, width: xR - xL, height: ch },
          { fill: mix(share) },
        ),
      );
      for (
        let x = xL + ((r % 2) * 0.5 + random() * 0.3) * size.brick * 0.6;
        x < xR;
        x += size.brick * (0.45 + random() * 0.3)
      ) {
        back.push(
          svg(
            'line',
            { x1: x, y1: y, x2: x + (random() - 0.5) * 2, y2: y + ch },
            { stroke: ink, 'stroke-width': '1.4px' },
          ),
        );
      }
      back.push(
        svg(
          'polyline',
          { points: points(jagged([xL, y + ch], [xR, y + ch], 5, JAG * 1.6)) },
          { fill: 'none', stroke: ink, 'stroke-width': '1.4px' },
        ),
      );
    }
    const shade = svg(
      'linearGradient',
      {
        id: id('shade'),
        gradientUnits: 'userSpaceOnUse',
        x1: xL,
        y1: 0,
        x2: xR,
        y2: 0,
      },
      {},
      [stop(0, 0.55), stop(0.45, 0)],
    );
    const deep = svg(
      'linearGradient',
      {
        id: id('deep'),
        gradientUnits: 'userSpaceOnUse',
        x1: 0,
        y1: ground,
        x2: 0,
        y2: bottom,
      },
      {},
      [stop(0.1, 0.1), stop(0.55, 0.85), stop(1, 1)],
    );
    back.push(
      svg('rect', {
        x: xL,
        y: ground,
        width: xR - xL,
        height: bottom - ground,
        fill: `url(#${id('shade')})`,
      }),
      svg('rect', {
        x: xL,
        y: ground,
        width: xR - xL,
        height: bottom - ground,
        fill: `url(#${id('deep')})`,
      }),
    );

    /* Side walls in section: one brick per course, inner faces uneven, some chipped or gone. */
    const walls: SVGElement[] = [];
    for (let y = ground, r = 0; y < bottom; y += ch, r += 1) {
      for (const side of [-1, 1] as const) {
        if (side === exitSide && y + ch > openFrom) continue;
        if (r > 1 && random() < GONE) continue;
        const w = Math.max(t * 0.5, t + JAG * t * (random() - 0.4));
        const x = side > 0 ? xR + t - w : xL - t;
        walls.push(brick(x, y, w, ch, side > 0 ? light : mix(84)));
      }
    }

    /* The ground under the hero, cut open beside the shaft: the site's bricks fading down and out. */
    const groundBricks: SVGElement[] = [];
    const top = bandHeight + heroEdge;
    for (let y = top, r = 0; y < bottom; y += ch * 1.6, r += 1) {
      for (const side of [-1, 1] as const) {
        if (side === exitSide && y + ch * 1.6 > openFrom) continue;
        let x = side < 0 ? xL - t : xR + t;
        for (let n = 0; n < size.groundBricks; n += 1) {
          const w = size.brick * (0.55 + random() * 0.5) * (phone ? 0.7 : 1);
          groundBricks.push(
            brick(
              side < 0 ? x - w : x,
              y,
              w,
              ch * 1.6,
              mix(92 - r * 6),
              edge * 0.6,
            ),
          );
          x += side * w;
        }
      }
    }

    const shaft = svg(
      'svg',
      {
        'aria-hidden': 'true',
        class: 'home-hole',
        viewBox: `0 ${ground} ${bandWidth} ${bottom - ground}`,
        width: bandWidth,
        height: bottom - ground,
      },
      { left: `${band.offsetLeft}px`, top: `${band.offsetTop + ground}px` },
      [
        svg('defs', {}, {}, [
          shade,
          deep,
          ...fade('walls', ground, [0.6, 1, 0.97, 0]),
          ...fade('ground', top, [0.1, 1, 1, 0]),
        ]),
        svg('g', { mask: `url(#${id('ground')})` }, {}, groundBricks),
        ...back,
        svg('g', { mask: `url(#${id('walls')})` }, {}, walls),
      ],
    );

    /* Over the ledge: bites torn out of the bricks beside the shaft, with pebbles in them. */
    const lip: SVGElement[] = [];
    for (const side of [-1, 1] as const) {
      const x0 = side < 0 ? xL - t : xR + t;
      const reach = size.brick * BITE_REACH * (0.7 + random() * 0.6);
      const depth = ledge * BITE_DEPTH;
      const xo = x0 + side * reach;
      const cut: Point[] = [
        [x0 - side * 2, ground - 1],
        [xo, ground - 1],
        ...jagged(
          [xo, ground - 1],
          [x0 - side * 2, ground + depth],
          6,
          phone ? 4 : 7,
        ).slice(0, -1),
        [x0 - side * 2, ground + depth],
      ];
      lip.push(
        svg(
          'polygon',
          { points: points(cut) },
          {
            fill: mix(30),
            stroke: ink,
            'stroke-width': `${edge * 0.75}px`,
            'stroke-linejoin': 'round',
          },
        ),
      );
      for (let k = 0; k < PEBBLES; k += 1) {
        const px = x0 + side * reach * (0.15 + random() * 0.6);
        const py = ground + depth * (0.3 + random() * 0.5);
        const s = phone ? 3 : 5;
        lip.push(
          svg(
            'polygon',
            {
              points: points([
                [px - s, py],
                [px - s * 0.2, py - s * 0.8],
                [px + s, py - s * 0.2],
                [px + s * 0.4, py + s * 0.7],
              ]),
            },
            { fill: mix(58), stroke: ink, 'stroke-width': '1.4px' },
          ),
        );
      }
    }
    const lipLayer = svg(
      'svg',
      {
        'aria-hidden': 'true',
        class: 'home-hole-lip',
        viewBox: `0 ${ground - 4} ${bandWidth} ${ledge + 4}`,
        width: bandWidth,
        height: ledge + 4,
      },
      { top: `${ground - 4}px` },
      lip,
    );

    hero.append(shaft);
    band.append(lipLayer);
    layers = [shaft, lipLayer];
  };

  band.dataset.hole = '';
  new ResizeObserver(() => {
    if (drawnFor === band.offsetWidth) return;
    drawnFor = band.offsetWidth;
    draw();
  }).observe(band);
};
