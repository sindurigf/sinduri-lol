/*
 * The footer rabbit pushes each wall below the fold out of its slot as it
 * scrolls in, and Knock It Down tumbles what is on screen. Styles: builder.css.
 * Nothing moves under reduced motion, and a focused wall lands at once.
 */
const REDUCED_MOTION = matchMedia('(prefers-reduced-motion: reduce)');
const WALLS = 'main :is(.card-block, .card:not(.card-block *))';
const TUMBLERS =
  'main :is(.card-block > *, .card:not(.card-block *), h2), footer :is(.footer-name, .footer-sticker)';
/* The rabbit stands on the wall, in the empty gap above it: never taller than that gap, nor than this. */
const RABBIT_MAX_PX = 48;
const RABBIT_MIN_PX = 16;
/* Kept clear above the rabbit: a heading's glyphs reach past its box. */
const RABBIT_CLEARANCE_PX = 8;
const PUSH_STAGGER_MS = 260;
/* Caps the stagger, so a jump that reveals many walls still lands them all within 5 s (SC 2.2.2). */
const PUSH_STAGGER_STEPS = 3;
const TUMBLE_STAGGER_MS = 50;
const TUMBLE_STAGGER_STEPS = 20;
const TUMBLE_DRIFT_PX = 200;
const TUMBLE_TURN_DEG = 140;
const KNOCK_LABEL = 'Knock It Down';

const tuft = document.querySelector<SVGSVGElement>('footer .footer-tuft');

/* Made here, not in the markup: without script or under reduced motion it would do nothing. */
/* Outside any form, so no `type`: it never submits. */
const knock = Object.assign(document.createElement('button'), {
  className: 'knock-down btn-secondary',
  textContent: KNOCK_LABEL,
});

/* Each wall's rabbit: kept outside the wall, so the wall's own clip and moves never touch it. */
const rabbits = new WeakMap<HTMLElement, HTMLElement>();

const settle = (element: HTMLElement): void => {
  element.removeAttribute('data-build');
  element.removeAttribute('data-act');
  element.style.removeProperty('animation-delay');
  element.style.removeProperty('--push');
  element.style.removeProperty('--push-y');
  rabbits.get(element)?.remove();
  rabbits.delete(element);
  /* Here, not on animationend: a brick landed early by focus or a press cancels its animation. */
  if (!document.querySelector('[data-build="tumble"]')) {
    delete document.documentElement.dataset.tumbling;
  }
};

interface PushPlan {
  readonly wall: HTMLElement;
  /* Where the rabbit goes: the wall's nearest ancestor that may hold a span. */
  readonly host: HTMLElement;
  readonly width: number;
  readonly height: number;
  /* In px, inside the host: the wall's left edge, the top it stands on, and the empty gap above. */
  readonly left: number;
  readonly floor: number;
  readonly room: number;
}

/* The lowest bottom of anything painted above `top` across the wall's width: what the rabbit must clear. */
const ceilingOver = (wall: HTMLElement, box: DOMRect, top: number): number =>
  Math.max(
    0,
    ...[...document.querySelectorAll('main *')]
      .filter((other) => !wall.contains(other) && !other.contains(wall))
      .map((other) => other.getBoundingClientRect())
      .filter(
        (other) =>
          other.width > 1 &&
          other.height > 1 &&
          other.top < top &&
          other.left < box.right &&
          other.right > box.left,
      )
      .map((other) => other.bottom),
  );

const planPush = (wall: HTMLElement): PushPlan => {
  const box = wall.getBoundingClientRect();
  let host = wall.parentElement!;
  while (host.matches('ul, ol, dl')) host = host.parentElement!;
  const frame = host.getBoundingClientRect();
  /* A wall's own parts, a hung label say, can rise above its top. */
  const top = Math.min(
    box.top,
    ...[...wall.querySelectorAll('*')]
      .map((part) => part.getBoundingClientRect())
      .filter((part) => part.width > 1 && part.height > 1)
      .map((part) => part.top),
  );
  return {
    wall,
    host,
    width: box.width,
    height: box.height,
    left: box.left - frame.left,
    floor: top - frame.top,
    room: top - ceilingOver(wall, box, top),
  };
};

const makeRabbit = (plan: PushPlan, delayMs: number): HTMLElement | null => {
  const height = Math.min(plan.room - RABBIT_CLEARANCE_PX, RABBIT_MAX_PX);
  if (!tuft || height < RABBIT_MIN_PX) return null;
  /* The rabbit's own box, kept beside its drawing in Footer.astro. */
  const crop = tuft.dataset.rabbitBox!;
  const [, , boxWidth, boxHeight] = crop.split(' ').map(Number);
  const width = (height * boxWidth!) / boxHeight!;
  const drawing = tuft.cloneNode(true) as SVGSVGElement;
  drawing
    .querySelectorAll('.tuft-back, .tuft-front')
    .forEach((grass) => grass.remove());
  drawing.setAttribute('viewBox', crop);
  const rabbit = document.createElement('span');
  rabbit.className = 'builder-rabbit';
  rabbit.setAttribute('aria-hidden', 'true');
  Object.assign(rabbit.style, {
    left: `${plan.left}px`,
    top: `${plan.floor - height}px`,
    width: `${width}px`,
    animationDelay: `${delayMs}ms`,
  });
  rabbit.style.setProperty('--run', `${plan.width - width}px`);
  rabbit.append(drawing);
  return rabbit;
};

/* How each wall arrives, by `data-act`, and the landing animation each ends on. */
const ACTS = ['slide', 'drop', 'stamp', 'unfold'] as const;
const LANDINGS = new Set([
  'build-push',
  'build-drop',
  'build-stamp',
  'build-unfold',
]);
/* A puff of dust either side of a landing, in the gap above the wall. */
const PUFF_MAX_PX = 14;
const PUFF_GROWTH = 1.6;

const puff = (plan: PushPlan): void => {
  const size = Math.min(
    PUFF_MAX_PX,
    (plan.room - RABBIT_CLEARANCE_PX) / PUFF_GROWTH,
  );
  if (size <= 0) return;
  for (const x of [plan.left, plan.left + plan.width - size]) {
    const dust = document.createElement('span');
    dust.className = 'builder-dust';
    dust.setAttribute('aria-hidden', 'true');
    Object.assign(dust.style, {
      left: `${x}px`,
      top: `${plan.floor - size}px`,
      width: `${size}px`,
    });
    dust.addEventListener('animationend', () => dust.remove());
    plan.host.append(dust);
  }
};

const push = (plan: PushPlan, delayMs: number): void => {
  const { wall } = plan;
  if (wall.dataset.build !== 'waiting') return;
  wall.style.setProperty('--push', `${plan.width}px`);
  wall.style.setProperty('--push-y', `${plan.height}px`);
  wall.style.animationDelay = `${delayMs}ms`;
  wall.dataset.act = ACTS[Math.floor(Math.random() * ACTS.length)];
  wall.dataset.build = 'push';
  const rabbit = makeRabbit(plan, delayMs);
  wall.addEventListener('animationend', (event) => {
    if (event.target !== wall || !LANDINGS.has(event.animationName)) return;
    puff(plan);
    if (rabbit) rabbit.classList.add('run');
    else settle(wall);
  });
  if (!rabbit) return;
  rabbit.dataset.act = wall.dataset.act;
  rabbits.set(wall, rabbit);
  /* The wall rests once its rabbit has gone. */
  rabbit.addEventListener('animationend', (event) => {
    if (event.animationName === 'build-run') settle(wall);
  });
  plan.host.append(rabbit);
};

/* Outermost walls only: a wall inside another builds with it. */
const walls = [...document.querySelectorAll<HTMLElement>(WALLS)].filter(
  (wall) => !wall.parentElement?.closest(WALLS),
);

const arm = (): IntersectionObserver => {
  const watcher = new IntersectionObserver((entries) => {
    const plans = entries
      .filter((entry) => entry.isIntersecting)
      .map((entry) => planPush(entry.target as HTMLElement));
    plans.forEach((plan, index) => {
      watcher.unobserve(plan.wall);
      push(plan, Math.min(index, PUSH_STAGGER_STEPS) * PUSH_STAGGER_MS);
    });
  });
  walls
    .filter((wall) => wall.getBoundingClientRect().top > innerHeight)
    .forEach((wall) => {
      wall.dataset.build = 'waiting';
      watcher.observe(wall);
    });
  return watcher;
};

const outermost = (elements: readonly HTMLElement[]): HTMLElement[] =>
  elements.filter(
    (element) =>
      !elements.some((outer) => outer !== element && outer.contains(element)),
  );

/* One per tumble: a new press drops the last one's listeners. */
let tumbleRun = new AbortController();

const tumble = (): void => {
  tumbleRun.abort();
  tumbleRun = new AbortController();
  const run = tumbleRun;
  const onScreen = outermost([
    ...document.querySelectorAll<HTMLElement>(TUMBLERS),
  ]).filter((brick) => {
    const { top, bottom } = brick.getBoundingClientRect();
    return bottom > 0 && top < innerHeight && !brick.contains(knock);
  });

  /* A cancelled kick is cleared by stopBuilding, which settles every [data-build]. */
  tuft?.setAttribute('data-build', 'kick');
  tuft?.addEventListener(
    'animationend',
    () => tuft.removeAttribute('data-build'),
    {
      once: true,
      signal: run.signal,
    },
  );

  onScreen.forEach((brick, index) => {
    settle(brick);
    brick.style.setProperty(
      '--tumble-x',
      `${(Math.random() - 0.5) * TUMBLE_DRIFT_PX}px`,
    );
    brick.style.setProperty(
      '--tumble-turn',
      `${(Math.random() - 0.5) * TUMBLE_TURN_DEG}deg`,
    );
    brick.style.animationDelay = `${Math.min(index, TUMBLE_STAGGER_STEPS) * TUMBLE_STAGGER_MS}ms`;
    brick.dataset.build = 'tumble';
    /* A cancelled tumble needs no listener: focus, a press or stopBuilding already settled it. */
    brick.addEventListener(
      'animationend',
      (event) => {
        if (event.target === brick) settle(brick);
      },
      { signal: run.signal },
    );
  });
  if (document.querySelector('[data-build="tumble"]')) {
    document.documentElement.dataset.tumbling = '';
  }
};

let observer: IntersectionObserver | null = null;

const startBuilding = (): void => {
  if (REDUCED_MOTION.matches) return;
  observer = arm();
  tuft?.before(knock);
};

const stopBuilding = (): void => {
  observer?.disconnect();
  observer = null;
  document.querySelectorAll<HTMLElement>('[data-build]').forEach(settle);
  delete document.documentElement.dataset.tumbling;
  knock.remove();
};

knock.addEventListener('click', tumble);

/* A wall that takes focus or a press lands at once, so a target never moves under it. */
const landNow = (event: Event): void => {
  const moving =
    event.target instanceof Element
      ? event.target.closest<HTMLElement>('[data-build]')
      : null;
  /* Still observed: a later entry finds it no longer waiting and leaves it. */
  if (moving) settle(moving);
};
document.addEventListener('focusin', landNow);
document.addEventListener('pointerdown', landNow);

REDUCED_MOTION.addEventListener('change', () => {
  if (REDUCED_MOTION.matches) stopBuilding();
  else if (!observer) startBuilding();
});

startBuilding();
