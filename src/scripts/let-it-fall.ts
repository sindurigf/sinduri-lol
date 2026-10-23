/* Let It Fall: everything on screen drops and stacks into a heap above the button, with the footer rabbit on top; the same button, Esc, keyboard focus elsewhere or a new window width puts it back. */
export {};

const LABEL_FALL = 'Let It Fall';
const LABEL_BACK = 'Put It Back';
const FELL = 'The page fell down. Press Put It Back to rebuild it.';
const BACK = 'The page is back in place.';
const NOTHING = 'Nothing on screen to drop. Scroll up and try again.';
/* Outermost of these move; their contents ride along. */
const BLOCKS = [
  '.header-slab',
  '.hero-window',
  'main :is(h1, h2, h3, p, ul, ol, figure, img, blockquote, table, pre, .card, .btn-primary, .btn-secondary, .badge, form > *)',
  /* The footer too: at the button on a phone, it is most of the screen. */
  'footer :is(.footer-stickers > li, nav li, .footer-copyright)',
].join(', ');
const TARGETS = 'a[href], button, input, select, textarea, summary';
/* px: the room kept around a control that did not fall, the space between stacked blocks, and the heap's margin. */
const PILE_GAP = 12;
const STACK_GAP = 4;
const EDGE = 16;
/* A block narrower than this share of the screen is small: it tilts more and drops into the lowest gap. */
const SMALL_SHARE = 0.4;
/* A block taller than this share of the screen stays, and the blocks inside it fall. */
const TALLEST_SHARE = 0.6;
const WIDE_DRIFT = 14;
const WIDE_TURN_DEG = 2;
const SMALL_TURN_DEG = 8;
/* px: where a small block or the rabbit may land is tried at this step, with this much random lean. */
const SLOT_STEP = 6;
const SLOT_JITTER = 10;
/* px: the bounce on landing and the rabbit's hop height; ms between landings; the hop's share of --fall-time. */
const BOUNCE = 14;
const HOP_HEIGHT = 70;
const LAND_STAGGER_MS = 55;
const HOP_SHARE = 0.7;
const FALL_EASING = 'cubic-bezier(0.55, 0, 1, 0.45)';
const LAND_AT = 0.72;
const BOUNCE_AT = 0.86;
const HALF_TURN_DEG = 180;
/* A second press this soon after the first is the same press, as when both wait on the first load. */
const REPEAT_MS = 300;

const button = document.querySelector<HTMLButtonElement>('[data-let-it-fall]');
const header = document.querySelector<HTMLElement>('.site-header');
const rabbit = document.querySelector<HTMLImageElement>('.footer-rabbit');
const status = document.querySelector<HTMLElement>('[data-let-it-fall-status]');
if (!button || !status) {
  throw new Error('let-it-fall: the footer lacks its button or status.');
}

const motion = matchMedia('(prefers-reduced-motion: no-preference)');
const token = (name: string): string =>
  getComputedStyle(document.documentElement).getPropertyValue(name).trim();
const MS_PER_S = 1000;
/* Minified CSS may write the time in seconds, as `.9s`. */
const fallTime = (): number => {
  const time = token('--fall-time');
  return parseFloat(time) * (time.endsWith('ms') ? 1 : MS_PER_S);
};

const say = (text: string): void => {
  status.textContent = '';
  requestAnimationFrame(() => {
    status.textContent = text;
  });
};

const spread = (range: number): number => (Math.random() - 0.5) * 2 * range;

/* A computed color's fourth number is its alpha; three numbers mean opaque. */
const RGBA_PARTS = 4;
const clear = (color: string): boolean => {
  const parts = color.match(/[\d.]+/g) ?? [];
  return parts.length === RGBA_PARTS && Number(parts[RGBA_PARTS - 1]) === 0;
};
/* The fill a block's text was drawn on, so it keeps its contrast wherever it lands (SC 1.4.3). */
const ground = (el: Element): string => {
  for (let at: Element | null = el; at; at = at.parentElement) {
    const fill = getComputedStyle(at).backgroundColor;
    if (!clear(fill)) return fill;
  }
  return getComputedStyle(document.body).backgroundColor;
};

let fallen: HTMLElement[] = [];
let lastPress = -Infinity;
let width = innerWidth;

const onScreen = (el: Element): boolean => {
  const { top, bottom, height } = el.getBoundingClientRect();
  return height > 0 && bottom > 0 && top < innerHeight;
};

/* A block already moved by its own transform, or inside a raised or clipping layer, would land above the button or vanish. */
const free = (el: Element): boolean => {
  if (getComputedStyle(el).transform !== 'none') return false;
  for (
    let up = el.parentElement;
    up && up !== document.body;
    up = up.parentElement
  ) {
    const style = getComputedStyle(up);
    if (style.zIndex !== 'auto' || style.overflow !== 'visible') return false;
  }
  return true;
};

/* A sticky header's heap would stay on screen as the page scrolls: held in flow where it is now, it scrolls with the rest, and drops below the button's layer. */
const PINNED = ['position', 'z-index', 'top'];
const pin = (): void => {
  if (!header || getComputedStyle(header).position !== 'sticky') return;
  const stuck = header.getBoundingClientRect().top;
  header.style.setProperty('position', 'relative');
  header.style.setProperty('z-index', 'auto');
  header.style.setProperty(
    'top',
    `${stuck - header.getBoundingClientRect().top}px`,
  );
};
const unpin = (): void => {
  for (const name of PINNED) header?.style.removeProperty(name);
};

type Spot = { left: number; right: number; top: number; bottom: number };
type Landing = {
  el: HTMLElement;
  x: number;
  y: number;
  turn: number;
  rank: number;
};

/*
 * The lowest bottom edge, at or above the floor, where a box of this span and
 * height fits clear of every spot, resting on the floor or a spot's top. Above
 * the screen only when no such place is on it.
 */
const lowestFit = (
  heap: Spot[],
  left: number,
  right: number,
  tall: number,
  floor: number,
): { bottom: number; resting: boolean } => {
  const column = heap.filter(
    (spot) => left < spot.right + STACK_GAP && spot.left - STACK_GAP < right,
  );
  const grounds = [floor, ...column.map((spot) => spot.top - STACK_GAP)]
    .filter((g) => g <= floor)
    .sort((a, b) => b - a);
  const free = (g: number) =>
    !column.some(
      (spot) => g - tall < spot.bottom + STACK_GAP && spot.top - STACK_GAP < g,
    );
  const fits = grounds.filter(free);
  const bottom = fits.find((g) => g - tall >= 0) ?? fits.at(-1) ?? floor;
  return { bottom, resting: bottom !== floor };
};

/*
 * Wide blocks land first in a shuffled order, then small ones, widest first,
 * into the lowest gap. Each takes its tilted box's room, so no two overlap and
 * every target stays whole (SC 2.5.8).
 */
const stack = (
  blocks: HTMLElement[],
  floor: number,
  solid: Spot[],
): { heap: Spot[]; landings: Landing[] } => {
  const screen = document.documentElement.clientWidth;
  const sized = blocks.map((el) => {
    const box = el.getBoundingClientRect();
    return {
      el,
      box,
      small: box.width < screen * SMALL_SHARE,
      key: Math.random(),
    };
  });
  const order = [
    ...sized.filter((b) => !b.small).sort((a, b) => a.key - b.key),
    ...sized.filter((b) => b.small).sort((a, b) => b.box.width - a.box.width),
  ];
  const heap = [...solid];
  const landings = order.map(({ el, box, small }, rank) => {
    const turn = spread(small ? SMALL_TURN_DEG : WIDE_TURN_DEG);
    const radians = (Math.abs(turn) * Math.PI) / HALF_TURN_DEG;
    const wide = box.width * Math.cos(radians) + box.height * Math.sin(radians);
    const tall = box.width * Math.sin(radians) + box.height * Math.cos(radians);
    const lo = EDGE;
    const hi = Math.max(lo, screen - EDGE - wide);
    const home = box.left + (box.width - wide) / 2;
    let left = Math.min(hi, Math.max(lo, home + spread(WIDE_DRIFT)));
    if (small) {
      let best = -Infinity;
      for (let x = lo; x <= hi; x += SLOT_STEP) {
        const room =
          lowestFit(heap, x, x + wide, tall, floor).bottom +
          Math.random() * SLOT_JITTER;
        if (room > best) {
          best = room;
          left = x;
        }
      }
    }
    const { bottom } = lowestFit(heap, left, left + wide, tall, floor);
    heap.push({ left, right: left + wide, top: bottom - tall, bottom });
    /* The transform turns about the block's center. */
    return {
      el,
      x: left + wide / 2 - (box.left + box.width / 2),
      y: bottom - tall / 2 - (box.top + box.height / 2),
      turn,
      rank,
    };
  });
  return { heap, landings };
};

type Hop = { x: number; y: number; scale: number };
/* The rabbit shrinks to these to fit the heap's top, as on a wide screen where the heap reaches the top. */
const HOP_SCALES = [1, 0.75, 0.5];

/* The highest place on the heap where the rabbit fits on screen, at the largest size that does; controls are spots, so it covers none. */
const perch = (heap: Spot[], floor: number): Hop | null => {
  if (!rabbit) return null;
  const box = rabbit.getBoundingClientRect();
  if (!box.width) return null;
  const screen = document.documentElement.clientWidth;
  for (const scale of HOP_SCALES) {
    const wide = box.width * scale;
    const tall = box.height * scale;
    let best: (Hop & { at: number }) | null = null;
    for (let left = EDGE; left + wide <= screen - EDGE; left += SLOT_STEP) {
      const { bottom, resting } = lowestFit(
        heap,
        left,
        left + wide,
        tall,
        floor,
      );
      const top = bottom - tall;
      const at = top + Math.random() * SLOT_JITTER;
      if (resting && top >= 0 && (!best || at < best.at)) {
        best = { x: left - box.left, y: top - box.top, scale, at };
      }
    }
    if (best) return { x: best.x, y: best.y, scale };
  }
  return null;
};

const HOP_VARS = ['--hop-x', '--hop-y', '--hop-scale'];

/* The rabbit leaps on an arc to the spot, or home for null; under reduced motion it is simply there. */
const hopTo = (spot: Hop | null): void => {
  if (!rabbit) return;
  const from = getComputedStyle(rabbit).transform;
  for (const animation of rabbit.getAnimations()) animation.cancel();
  if (spot) {
    rabbit.style.setProperty('--hop-x', `${spot.x}px`);
    rabbit.style.setProperty('--hop-y', `${spot.y}px`);
    rabbit.style.setProperty('--hop-scale', String(spot.scale));
    rabbit.setAttribute('data-hopped', '');
  } else {
    rabbit.removeAttribute('data-hopped');
    for (const name of HOP_VARS) rabbit.style.removeProperty(name);
  }
  if (!motion.matches) return;
  const start = from === 'none' ? new DOMMatrix() : new DOMMatrix(from);
  const end = spot
    ? new DOMMatrix().translate(spot.x, spot.y).scale(spot.scale)
    : new DOMMatrix();
  const high = Math.min(start.f, end.f) - HOP_HEIGHT;
  rabbit.animate(
    [
      { transform: start.toString() },
      {
        transform: `translate(${(start.e + end.e) / 2}px, ${high}px) scale(${(start.a + end.a) / 2})`,
        offset: 0.5,
      },
      { transform: end.toString() },
    ],
    { duration: fallTime() * HOP_SHARE, easing: 'ease-in-out' },
  );
};

/* A new fall or Put It Back cancels a running move on purpose; anything else is a real error. */
const ignoreCancel = (error: unknown): void => {
  if (!(error instanceof DOMException && error.name === 'AbortError')) {
    reportError(error);
  }
};

const FALL_VARS = ['--fall-x', '--fall-y', '--fall-turn', '--fall-ground'];

/* Home at once: drops the clip and offsets, so a block is measured where it rests. */
const home = (el: HTMLElement): void => {
  for (const animation of el.getAnimations()) animation.cancel();
  el.removeAttribute('data-fall-block');
  el.removeAttribute('data-fall-raised');
  for (const name of FALL_VARS) el.style.removeProperty(name);
  if (header?.contains(el)) unpin();
};

const drop = ({ el, x, y, turn, rank }: Landing): Animation | null => {
  el.style.setProperty('--fall-x', `${x}px`);
  el.style.setProperty('--fall-y', `${y}px`);
  el.style.setProperty('--fall-turn', `${turn}deg`);
  el.style.setProperty('--fall-ground', ground(el));
  el.setAttribute('data-fall-block', '');
  el.setAttribute('data-fell', '');
  /* Above content that stays, as a tall card the heap lands on: it comes later and would paint over it. */
  const style = getComputedStyle(el);
  if (style.position === 'static' && style.zIndex === 'auto') {
    el.setAttribute('data-fall-raised', '');
  }
  if (!motion.matches) return null;
  const at = (lift: number) =>
    `translate(${x}px, ${y - lift}px) rotate(${turn}deg)`;
  return el.animate(
    [
      { transform: 'none', easing: FALL_EASING },
      { transform: at(0), offset: LAND_AT, easing: 'ease-out' },
      { transform: at(BOUNCE), offset: BOUNCE_AT, easing: 'ease-in' },
      { transform: at(0) },
    ],
    {
      duration: fallTime(),
      delay: rank * LAND_STAGGER_MS,
      fill: 'backwards',
    },
  );
};

const fall = (): void => {
  /* A press mid-climb: the climbing blocks snap home first, or their clip and transforms would hide them from the next fall. */
  for (const el of document.querySelectorAll<HTMLElement>(
    '[data-fall-block]',
  )) {
    home(el);
  }
  pin();
  const tallest = innerHeight * TALLEST_SHARE;
  const candidates = [...document.querySelectorAll<HTMLElement>(BLOCKS)].filter(
    (el) =>
      onScreen(el) && free(el) && el.getBoundingClientRect().height <= tallest,
  );
  fallen = candidates.filter(
    (el) => !candidates.some((other) => other !== el && other.contains(el)),
  );
  if (!fallen.some((el) => header?.contains(el))) unpin();
  if (!fallen.length) {
    say(NOTHING);
    return;
  }
  /* Marked before measuring: a falling footer row shrinks to its link. */
  for (const el of fallen) el.setAttribute('data-fall-block', '');
  const floor = innerHeight - EDGE;
  /* Put It Back and every control that stays are solid: the heap lands on them, never over them. */
  const solid = [...document.querySelectorAll(TARGETS)]
    .filter(
      (el) =>
        onScreen(el) &&
        el.checkVisibility() &&
        !fallen.some((block) => block.contains(el)),
    )
    .map((el) => {
      const { left, right, top, bottom } = el.getBoundingClientRect();
      return {
        left: left - PILE_GAP,
        right: right + PILE_GAP,
        top: top - PILE_GAP,
        bottom: bottom + PILE_GAP,
      };
    });
  const { heap, landings } = stack(fallen, floor, solid);
  const spot = perch(heap, floor);
  const moves = landings
    .map(drop)
    .filter((a): a is Animation => a !== null)
    .map((a) => a.finished);
  const pile = fallen;
  void Promise.all(moves)
    .then(async () => {
      if (!rabbit || !spot || fallen !== pile) return;
      /* Lazy below the fold; it must be drawn before it leaps. */
      rabbit.loading = 'eager';
      await rabbit.decode();
      if (fallen === pile) hopTo(spot);
    })
    .catch(ignoreCancel);
  width = innerWidth;
  button.textContent = LABEL_BACK;
  say(FELL);
};

const restore = (): void => {
  /* The page may have scrolled since the fall: home for the header is where it sticks now. */
  if (header?.style.position) {
    unpin();
    pin();
  }
  if (rabbit?.hasAttribute('data-hopped')) hopTo(null);
  for (const el of fallen) {
    const from = getComputedStyle(el).transform;
    el.removeAttribute('data-fell');
    if (!motion.matches) {
      home(el);
      continue;
    }
    for (const animation of el.getAnimations()) animation.cancel();
    const climb = el.animate([{ transform: from }, { transform: 'none' }], {
      duration: fallTime(),
      easing: token('--ease-spring'),
    });
    void climb.finished.then(() => {
      if (!el.hasAttribute('data-fell')) home(el);
    }, ignoreCancel);
  }
  fallen = [];
  button.textContent = LABEL_FALL;
  say(BACK);
};

button.addEventListener('on-demand', () => {
  const now = performance.now();
  if (now - lastPress < REPEAT_MS) return;
  lastPress = now;
  if (fallen.length) restore();
  else fall();
});
addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && fallen.length) restore();
});
/* SC 2.4.11: keyboard focus never lands on a block out of place. A click or tap on a link or button in the heap focuses without :focus-visible, so it still works; a text field puts the page back. */
addEventListener('focusin', (event) => {
  const target = event.target;
  if (
    fallen.length &&
    target !== button &&
    target instanceof Element &&
    target.matches(':focus-visible')
  ) {
    restore();
  }
});
/* Offsets are measured for one width; a rotated phone or a zoom would leave the heap in the wrong place. */
addEventListener('resize', () => {
  if (fallen.length && innerWidth !== width) restore();
});
