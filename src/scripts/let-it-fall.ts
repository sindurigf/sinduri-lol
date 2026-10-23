/* Let It Fall: everything on screen drops into a pile above the button, its links still live; the same button, Esc, keyboard focus elsewhere or a new window width puts it back. */
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
  'main :is(h1, h2, h3, p, ul, ol, figure, img, blockquote, table, pre, .card, .btn-primary, .btn-secondary, .badge)',
  /* The footer too: at the button on a phone, it is most of the screen. */
  'footer :is(.footer-stickers > li, nav li, .footer-copyright)',
].join(', ');
const TARGETS = 'a[href], button, input, select, textarea, summary';
/* px: how far the pile stops short of the button, and the scatter of its blocks. */
const PILE_GAP = 12;
const PILE_SCATTER = 60;
/* Of the screen height: the pile spreads over this much, so more of its links land on top. */
const PILE_SHARE = 0.5;
const DRIFT = 20;
const TURN_DEG = 25;
/* px: a wide block tilts less, so its ends differ in height by no more than this and bury less of the pile. */
const MAX_TILT_RISE = 120;
const STAGGER_MS = 25;
const HALF_TURN_DEG = 180;
/* A second press this soon after the first is the same press, as when both wait on the first load. */
const REPEAT_MS = 300;

const button = document.querySelector<HTMLButtonElement>('[data-let-it-fall]');
const header = document.querySelector<HTMLElement>('.site-header');
const status = document.querySelector<HTMLElement>('[data-let-it-fall-status]');
if (!button || !status) {
  throw new Error('let-it-fall: the footer lacks its button or status.');
}

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

/* A sticky header's pile would stay on screen as the page scrolls: held in flow where it is now, it scrolls with the rest, and drops below the button's layer. */
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

const unbury = (block: Element): void => {
  for (const el of block.querySelectorAll('[data-fall-buried]')) {
    el.removeAttribute('data-fall-buried');
  }
  block.removeAttribute('data-fall-buried');
};

/* Points per side sampled across a target's box on screen. */
const PROBES = 6;

/*
 * Every probe that lands on the target's own drawn shape finds it on top. Probes
 * outside its shape, tilted or not, or off screen do not count; a target with none on screen is buried.
 */
const uncovered = (el: Element): boolean => {
  const box = el.getBoundingClientRect();
  let seen = 0;
  for (let i = 0; i < PROBES; i++) {
    for (let j = 0; j < PROBES; j++) {
      const x = box.left + (box.width * (i + 0.5)) / PROBES;
      const y = box.top + (box.height * (j + 0.5)) / PROBES;
      const stack = document.elementsFromPoint(x, y);
      if (!stack.some((hit) => el.contains(hit))) continue;
      seen++;
      if (!stack[0] || !el.contains(stack[0])) return false;
    }
  }
  return seen > 0;
};

/*
 * SC 2.5.8: a target with any part covered takes no pointer input, so every live
 * target in the pile is whole. Keyboard and screen readers still reach them all.
 */
const bury = (): void => {
  const targets = fallen.flatMap((block) =>
    [block, ...block.querySelectorAll(TARGETS)].filter((el) =>
      el.matches(TARGETS),
    ),
  );
  for (const el of targets) el.removeAttribute('data-fall-buried');
  /* All are measured before any is buried, as a buried target lets probes through. */
  const covered = targets.filter((el) => !uncovered(el));
  for (const el of covered) el.setAttribute('data-fall-buried', '');
};

const FALL_VARS = [
  '--fall-x',
  '--fall-y',
  '--fall-turn',
  '--fall-ground',
  '--fall-delay',
];

/* Home at once: drops the fall's transition, clip and offsets, so a block is measured where it rests. */
const home = (el: HTMLElement): void => {
  /* Dropping the transition rule does not stop a running transition; cancelling does. */
  for (const animation of el.getAnimations()) animation.cancel();
  el.removeAttribute('data-fall-block');
  unbury(el);
  for (const name of FALL_VARS) el.style.removeProperty(name);
  if (header?.contains(el)) unpin();
};

/* A new fall or Put It Back cancels a running move on purpose; anything else is a real error. */
const ignoreCancel = (error: unknown): void => {
  if (!(error instanceof DOMException && error.name === 'AbortError')) {
    reportError(error);
  }
};

/* Once a block has climbed home, it drops its transition, so its own hover and press timing come back. */
const settle = (el: HTMLElement): void => {
  void Promise.all(el.getAnimations().map((a) => a.finished)).then(() => {
    if (!el.hasAttribute('data-fell')) home(el);
  }, ignoreCancel);
};

const fall = (): void => {
  /* A press mid-climb: the climbing blocks snap home first, or their clip and transforms would hide them from the next fall. */
  for (const el of document.querySelectorAll<HTMLElement>(
    '[data-fall-block]',
  )) {
    home(el);
  }
  pin();
  const candidates = [...document.querySelectorAll<HTMLElement>(BLOCKS)].filter(
    (el) => onScreen(el) && free(el),
  );
  fallen = candidates.filter(
    (el) => !candidates.some((other) => other !== el && other.contains(el)),
  );
  if (!fallen.some((el) => header?.contains(el))) unpin();
  if (!fallen.length) {
    say(NOTHING);
    return;
  }
  const floor =
    Math.min(innerHeight, button.getBoundingClientRect().top) - PILE_GAP;
  fallen.forEach((el, index) => {
    const box = el.getBoundingClientRect();
    const widest = Math.asin(Math.min(1, MAX_TILT_RISE / box.width));
    const turn = spread(Math.min(TURN_DEG, (widest * HALF_TURN_DEG) / Math.PI));
    const radians = (Math.abs(turn) * Math.PI) / HALF_TURN_DEG;
    /* A tilted block reaches lower than its upright box: half its rotated height gain. */
    const tilt =
      (box.width * Math.sin(radians) +
        box.height * Math.cos(radians) -
        box.height) /
      2;
    /* Negative for a block already near the button: it rises just enough to tilt clear of it. */
    const drop =
      floor -
      box.bottom -
      tilt -
      Math.random() * Math.max(PILE_SCATTER, innerHeight * PILE_SHARE);
    el.style.setProperty('--fall-x', `${spread(DRIFT)}px`);
    el.style.setProperty('--fall-y', `${drop}px`);
    el.style.setProperty('--fall-turn', `${turn}deg`);
    el.style.setProperty('--fall-ground', ground(el));
    el.style.setProperty('--fall-delay', `${index * STAGGER_MS}ms`);
    el.setAttribute('data-fall-block', '');
    el.setAttribute('data-fell', '');
  });
  const moving = fallen;
  void Promise.all(
    fallen.flatMap((el) => el.getAnimations()).map((a) => a.finished),
  ).then(() => {
    if (fallen === moving) bury();
  }, ignoreCancel);
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
  for (const el of fallen) {
    el.removeAttribute('data-fell');
    unbury(el);
    settle(el);
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
/* SC 2.4.11: keyboard focus never lands on a block out of place. A click or tap on a link or button in the pile focuses without :focus-visible, so it still works; a text field puts the page back. */
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
/* Scrolling shows parts of the pile the last check could not see, and resizes the compact header. */
addEventListener('scrollend', () => {
  if (fallen.some((el) => el.getAnimations().length)) return;
  if (fallen.length) bury();
});
/* Offsets are measured for one width; a rotated phone or a zoom would leave the pile in the wrong place. */
addEventListener('resize', () => {
  if (fallen.length && innerWidth !== width) restore();
});
