/*
 * The footer rabbit pushes each brick below the fold into place as it scrolls
 * in, and Knock It Down tumbles what is on screen. Styles: builder.css.
 * Nothing moves under reduced motion, and a focused brick stops at once.
 */
const REDUCED_MOTION = matchMedia('(prefers-reduced-motion: reduce)');
const BRICKS = 'main :is(.card-block > *, .card:not(.card-block *))';
const TUMBLERS = `${BRICKS}, main h2, footer :is(.footer-name, .footer-sticker)`;
/* Walls the About cats stand on: they read brick positions while they play. */
const CAT_BAND = 'section:has(.cat-perch)';
/* The rabbit without its grass, cropped to its body and throw. */
const RABBIT_VIEW_BOX = '-96 -94 192 102';
const RABBIT_EXITS = new Set(['build-hop-off', 'build-ride-off']);
const PUSH_STAGGER_MS = 260;
const TUMBLE_STAGGER_MS = 50;
const TUMBLE_DRIFT_PX = 200;
const TUMBLE_TURN_DEG = 140;
/* Starts a push once a brick is this far into the viewport. */
const ENTER_MARGIN = '0px 0px -12% 0px';

const tuft = document.querySelector<SVGSVGElement>('footer .footer-tuft');
const KNOCK_LABEL = 'Knock It Down';

/* Made here, not in the markup: without script or under reduced motion it would do nothing. */
const makeKnock = (): HTMLButtonElement => {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'knock-down btn-secondary';
  button.textContent = KNOCK_LABEL;
  return button;
};

const knock = makeKnock();

const settle = (brick: HTMLElement): void => {
  brick.removeAttribute('data-build');
  brick.style.removeProperty('animation-delay');
  brick.querySelector(':scope > .builder-rabbit')?.remove();
};

const makeRabbit = (delayMs: number): HTMLElement | null => {
  if (!tuft) return null;
  const drawing = tuft.cloneNode(true) as SVGSVGElement;
  drawing.querySelectorAll('.tuft-back, .tuft-front').forEach((grass) => {
    grass.remove();
  });
  drawing.setAttribute('viewBox', RABBIT_VIEW_BOX);
  const rabbit = document.createElement('span');
  rabbit.className = 'builder-rabbit';
  rabbit.setAttribute('aria-hidden', 'true');
  rabbit.style.animationDelay = `${delayMs}ms`;
  rabbit.append(drawing);
  return rabbit;
};

const push = (brick: HTMLElement, delayMs: number): void => {
  const room = brick.getBoundingClientRect().left;
  brick.dataset.build = 'push';
  brick.style.animationDelay = `${delayMs}ms`;
  const rabbit = makeRabbit(delayMs);
  if (!rabbit) return;
  rabbit.addEventListener('animationend', (event) => {
    if (RABBIT_EXITS.has(event.animationName)) settle(brick);
  });
  brick.append(rabbit);
  /* With no room beside the brick on screen, the rabbit rides on top of it instead. */
  if (room < rabbit.getBoundingClientRect().width) {
    rabbit.classList.add('builder-rabbit-ride');
  }
};

const bricks = [...document.querySelectorAll<HTMLElement>(BRICKS)].filter(
  (brick) => !brick.closest(CAT_BAND),
);

const arm = (): IntersectionObserver => {
  const observer = new IntersectionObserver(
    (entries) => {
      entries
        .filter((entry) => entry.isIntersecting)
        .forEach((entry, index) => {
          observer.unobserve(entry.target);
          push(entry.target as HTMLElement, index * PUSH_STAGGER_MS);
        });
    },
    { rootMargin: ENTER_MARGIN },
  );
  bricks
    .filter((brick) => brick.getBoundingClientRect().top > innerHeight)
    .forEach((brick) => {
      brick.dataset.build = 'waiting';
      observer.observe(brick);
    });
  return observer;
};

const tumble = (): void => {
  tuft?.setAttribute('data-build', 'kick');
  tuft?.addEventListener(
    'animationend',
    () => tuft.removeAttribute('data-build'),
    {
      once: true,
    },
  );
  const tumblers = [...document.querySelectorAll<HTMLElement>(TUMBLERS)];
  tumblers
    .filter(
      (brick) =>
        !tumblers.some((outer) => outer !== brick && outer.contains(brick)),
    )
    .filter((brick) => {
      const { top, bottom } = brick.getBoundingClientRect();
      return bottom > 0 && top < innerHeight && !brick.contains(knock);
    })
    .forEach((brick, index) => {
      settle(brick);
      brick.style.setProperty(
        '--tumble-x',
        `${Math.round((Math.random() - 0.5) * TUMBLE_DRIFT_PX)}px`,
      );
      brick.style.setProperty(
        '--tumble-turn',
        `${Math.round((Math.random() - 0.5) * TUMBLE_TURN_DEG)}deg`,
      );
      brick.style.animationDelay = `${index * TUMBLE_STAGGER_MS}ms`;
      brick.dataset.build = 'tumble';
      const land = (event: AnimationEvent): void => {
        if (event.animationName !== 'build-tumble') return;
        brick.removeEventListener('animationend', land);
        settle(brick);
      };
      brick.addEventListener('animationend', land);
    });
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
  knock.remove();
};

knock.addEventListener('click', tumble);

/* A brick that takes focus or a press lands at once, so a target never moves under it. */
const landNow = (event: Event): void => {
  const brick =
    event.target instanceof Element
      ? event.target.closest<HTMLElement>('[data-build]')
      : null;
  if (!brick) return;
  observer?.unobserve(brick);
  settle(brick);
};
document.addEventListener('focusin', landNow);
document.addEventListener('pointerdown', landNow);

REDUCED_MOTION.addEventListener('change', () => {
  if (REDUCED_MOTION.matches) stopBuilding();
  else if (!observer) startBuilding();
});

startBuilding();
