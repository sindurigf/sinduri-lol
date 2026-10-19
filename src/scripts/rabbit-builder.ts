/*
 * The footer rabbit pushes each wall below the fold out of its slot as it
 * scrolls in, and Knock It Down tumbles what is on screen. Styles: builder.css.
 * Nothing moves under reduced motion, and a focused wall lands at once.
 */
const REDUCED_MOTION = matchMedia('(prefers-reduced-motion: reduce)');
const WALLS = 'main :is(.card-block, .card:not(.card-block *))';
const TUMBLERS =
  'main :is(.card-block > *, .card:not(.card-block *), h2), footer :is(.footer-name, .footer-sticker)';
/* Walls the About cats stand on: they read brick positions while they play. */
const CAT_BAND = 'section:has(.cat-perch)';
/* The rabbit without its grass, cropped to its body and throw. */
const RABBIT_VIEW_BOX = '-96 -94 192 102';
const RABBIT_ASPECT = 192 / 102;
/* Share of the wall's bottom padding the rabbit stands in, so it never reaches text. */
const RABBIT_FILL = 0.8;
const PUSH_STAGGER_MS = 260;
/* Caps the stagger, so a jump that reveals many walls still lands them all within 5 s (SC 2.2.2). */
const PUSH_STAGGER_STEPS = 3;
const TUMBLE_STAGGER_MS = 50;
const TUMBLE_STAGGER_STEPS = 20;
const TUMBLE_DRIFT_PX = 200;
const TUMBLE_TURN_DEG = 140;
const KNOCK_LABEL = 'Knock It Down';

const tuft = document.querySelector<SVGSVGElement>('footer .footer-tuft');
const pushMs = (): number =>
  parseFloat(
    getComputedStyle(document.documentElement).getPropertyValue('--build-push'),
  );

/* Made here, not in the markup: without script or under reduced motion it would do nothing. */
const makeKnock = (): HTMLButtonElement => {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'knock-down btn-secondary';
  button.textContent = KNOCK_LABEL;
  return button;
};

const knock = makeKnock();

const settle = (element: HTMLElement): void => {
  element.removeAttribute('data-build');
  element.style.removeProperty('animation-delay');
  element.style.removeProperty('--push');
  element.querySelectorAll<HTMLElement>('[data-build-host]').forEach((host) => {
    delete host.dataset.buildHost;
  });
  element.querySelector('.builder-rabbit')?.remove();
  /* Here, not on animationend: a brick landed early by focus or a press cancels its animation. */
  if (!document.querySelector('[data-build="tumble"]')) {
    delete document.documentElement.dataset.tumbling;
  }
};

/* The brick whose bottom padding the rabbit stands in: a card's own, or a wall's first. */
const hostOf = (wall: HTMLElement): HTMLElement | null => {
  const first = wall.matches('.card')
    ? wall
    : (wall.firstElementChild as HTMLElement | null);
  return first?.querySelector<HTMLElement>('.card') ?? first;
};

interface PushPlan {
  readonly wall: HTMLElement;
  readonly width: number;
  readonly host: HTMLElement | null;
  readonly paddingLeft: number;
  readonly paddingBottom: number;
  readonly room: number;
}

const planPush = (wall: HTMLElement): PushPlan => {
  const host = hostOf(wall);
  const style = host ? getComputedStyle(host) : null;
  return {
    wall,
    width: wall.getBoundingClientRect().width,
    host,
    paddingLeft: parseFloat(style?.paddingLeft ?? '0'),
    paddingBottom: parseFloat(style?.paddingBottom ?? '0'),
    room: host?.clientWidth ?? 0,
  };
};

const makeRabbit = (plan: PushPlan, delayMs: number): HTMLElement | null => {
  if (!tuft || !plan.host) return null;
  const height = plan.paddingBottom * RABBIT_FILL;
  const width = height * RABBIT_ASPECT;
  const drawing = tuft.cloneNode(true) as SVGSVGElement;
  drawing.querySelectorAll('.tuft-back, .tuft-front').forEach((grass) => {
    grass.remove();
  });
  drawing.setAttribute('viewBox', RABBIT_VIEW_BOX);
  const rabbit = document.createElement('span');
  rabbit.className = 'builder-rabbit';
  rabbit.setAttribute('aria-hidden', 'true');
  Object.assign(rabbit.style, {
    left: `${plan.paddingLeft}px`,
    bottom: `${(plan.paddingBottom - height) / 2}px`,
    width: `${width}px`,
    animationDelay: `${delayMs}ms, ${delayMs + pushMs()}ms`,
  });
  rabbit.style.setProperty('--push', `${plan.width}px`);
  rabbit.style.setProperty(
    '--run',
    `${Math.max(0, plan.room - plan.paddingLeft * 2 - width)}px`,
  );
  rabbit.append(drawing);
  return rabbit;
};

const push = (plan: PushPlan, delayMs: number): void => {
  const { wall, host } = plan;
  if (wall.dataset.build !== 'waiting') return;
  wall.style.setProperty('--push', `${plan.width}px`);
  wall.style.animationDelay = `${delayMs}ms`;
  wall.dataset.build = 'push';
  const rabbit = makeRabbit(plan, delayMs);
  if (!rabbit || !host) {
    wall.addEventListener('animationend', () => settle(wall), { once: true });
    return;
  }
  host.dataset.buildHost = '';
  rabbit.addEventListener('animationend', (event) => {
    if (event.animationName === 'build-run') settle(wall);
  });
  host.append(rabbit);
};

const walls = [...document.querySelectorAll<HTMLElement>(WALLS)].filter(
  (wall) => !wall.closest(CAT_BAND),
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

const tumble = (): void => {
  const run = new AbortController();
  const onScreen = outermost([
    ...document.querySelectorAll<HTMLElement>(TUMBLERS),
  ]).filter((brick) => {
    const { top, bottom } = brick.getBoundingClientRect();
    return bottom > 0 && top < innerHeight && !brick.contains(knock);
  });

  tuft?.setAttribute('data-build', 'kick');
  for (const type of ['animationend', 'animationcancel']) {
    tuft?.addEventListener(type, () => tuft.removeAttribute('data-build'), {
      once: true,
      signal: run.signal,
    });
  }

  onScreen.forEach((brick, index) => {
    settle(brick);
    brick.style.setProperty(
      '--tumble-x',
      `${Math.round((Math.random() - 0.5) * TUMBLE_DRIFT_PX)}px`,
    );
    brick.style.setProperty(
      '--tumble-turn',
      `${Math.round((Math.random() - 0.5) * TUMBLE_TURN_DEG)}deg`,
    );
    brick.style.animationDelay = `${Math.min(index, TUMBLE_STAGGER_STEPS) * TUMBLE_STAGGER_MS}ms`;
    brick.dataset.build = 'tumble';
    const land = (event: AnimationEvent): void => {
      if (event.target !== brick) return;
      brick.removeEventListener('animationend', land);
      brick.removeEventListener('animationcancel', land);
      settle(brick);
    };
    brick.addEventListener('animationend', land, { signal: run.signal });
    brick.addEventListener('animationcancel', land, { signal: run.signal });
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
  if (!moving) return;
  observer?.unobserve(moving);
  settle(moving);
};
document.addEventListener('focusin', landNow);
document.addEventListener('pointerdown', landNow);

REDUCED_MOTION.addEventListener('change', () => {
  if (REDUCED_MOTION.matches) stopBuilding();
  else if (!observer) startBuilding();
});

startBuilding();
