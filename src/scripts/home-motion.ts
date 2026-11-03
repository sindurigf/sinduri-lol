/*
 * The homepage's motion: the rabbit hopping on the meadow and Alice's things
 * rising past the fall. One loop drives both and both pause controls stop it
 * (SC 2.2.2). Reduced motion draws one still frame and hides the controls.
 */
import { NEXT_FRAME, createMotionLoop } from './motion-loop';
import type { RabbitPose } from '../lib/rabbit-atlas';

/* Slow, small motion: 30 frames a second is plenty and halves the main-thread cost. */
const MAX_FRAME_RATE = 30;
/* Caps the step after a stall so nothing jumps across the page. */
const MAX_DELTA_MS = 100;
const VIEW_MARGIN = '120px';

/* Rabbit: px from the band's edges and the mouth it never hops into. */
const EDGE_PX = 44;
const MOUTH_CLEAR_PX = 64;
const HOME_SHARE = 0.45;
const HOP_MIN_PX = 60;
const HOP_MAX_PX = 150;
const HOP_HEIGHT_MIN_PX = 26;
const HOP_HEIGHT_MAX_PX = 64;
const HOP_HEIGHT_PER_PX = 0.25;
const HOP_MS_MIN = 380;
const HOP_MS_MAX = 620;
const HOP_MS_BASE = 360;
const HOP_MS_PER_PX = 1.4;
const TURN_CHANCE = 0.2;
const CROUCH_MS = 150;
const LAND_MS = 130;
const REST_MS_MIN = 900;
const REST_MS_MAX = 2400;
const LOOK_REST_MS = 1500;
const LOOK_FROM = 0.3;
const LOOK_TO = 0.75;
const FIRST_REST_MS = 700;

/* Grass sways always and wobbles where the rabbit lands; clods fly up and fall. */
const SWAY_DEG = 2.5;
const SWAY_PERIOD_MS = 3400;
const SWAY_PHASE_STEP = 1.7;
const WOBBLE_DEG = 7;
const WOBBLE_MS = 700;
const WOBBLE_HZ_MS = 45;
const WOBBLE_REACH_PX = 90;
const CLOD_MS = 420;
const CLOD_SPREAD_PX = 10;
const CLOD_SIDE_SPEED = 0.09;
const CLOD_JITTER = 0.02;
const CLOD_LIFT_MIN = 0.32;
const CLOD_LIFT_MAX = 0.42;
const CLOD_GRAVITY = 0.0016;
const CLOD_SPIN_MS_PER_DEG = 3;

/* Things: a 900px view takes about 26 seconds to cross. */
const RISE_PX_PER_S = 34;
const TURN_DEG = 4;
const TURN_MS_BASE = 7000;
const TURN_MS_STEP = 1300;
const FIRST_Y_PX = 140;

/* The jar: tossed up out of view, or flipped where nothing may move. */
const TOSS_MS = 1200;
const TOSS_TURN_DEG = 540;
const TOSS_CLEAR_PX = 48;
const TOSS_EASING = 'cubic-bezier(.3, .1, .7, .6)';
const FLIP_MS = 1500;
const LOOK_UP_MS = 1400;

const PAUSE_NAME = 'Pause animations';
const PLAY_NAME = 'Play animations';
const PAUSE_GLYPH = '❚❚';
const PLAY_GLYPH = '▶';

const random = (low: number, high: number): number =>
  low + Math.random() * (high - low);
const clamp = (value: number, low: number, high: number): number =>
  Math.min(high, Math.max(low, value));
const wait = (ms: number): Promise<void> =>
  new Promise((resolve) => window.setTimeout(resolve, ms));

type Phase = 'rest' | 'crouch' | 'air' | 'land';

interface Hop {
  x: number;
  y: number;
  dir: 1 | -1;
  phase: Phase;
  since: number;
  length: number;
  from: number;
  to: number;
  height: number;
  looks: boolean;
}

interface Thing {
  readonly el: HTMLElement;
  readonly face: HTMLElement;
  readonly tilt: number;
  readonly turnMs: number;
  offset: number;
}

const required = <T extends Element>(root: ParentNode, selector: string): T => {
  const found = root.querySelector<T>(selector);
  if (!found) throw new Error(`home-motion: ${selector} is missing.`);
  return found;
};

const start = (): void => {
  const band = document.querySelector<HTMLElement>('[data-home-band]');
  if (!band) return;
  const hopper = required<HTMLElement>(band, '[data-home-hopper]');
  const bun = required<HTMLElement>(hopper, '.home-bun');
  const mouth = required<HTMLElement>(document, '[data-home-mouth]');
  const drift = required<HTMLElement>(document, '[data-home-drift]');
  const jar = required<HTMLButtonElement>(drift, '[data-home-jar]');
  const jarSpin = required<HTMLElement>(jar, '.home-prop-spin');
  const pauses = [
    ...document.querySelectorAll<HTMLButtonElement>('[data-home-pause]'),
  ];
  const tufts = [...band.querySelectorAll<HTMLElement>('.home-tuft')];
  const clods = [...band.querySelectorAll<HTMLElement>('.home-clod')];

  const things: Thing[] = [
    ...drift.querySelectorAll<HTMLElement>('[data-home-prop]'),
  ].map((el, index) => ({
    el,
    face: required<HTMLElement>(el, '.home-prop-face'),
    tilt: Number(el.dataset.tilt) || 0,
    turnMs: TURN_MS_BASE + index * TURN_MS_STEP,
    offset: 0,
  }));

  let paused = false;
  let clock = 0;
  let last = 0;
  let lookUntil = -1;
  let tossing = false;
  let roamMax = 0;
  let driftHeight = 0;
  let thingSize = 0;
  const tuftX = tufts.map(() => 0);
  const tuftKick = tufts.map(() => -Infinity);
  const clodState = clods.map(() => ({ born: -Infinity, x: 0, vx: 0, vy: 0 }));
  const hop: Hop = {
    x: 0,
    y: 0,
    dir: 1,
    phase: 'rest',
    since: 0,
    length: FIRST_REST_MS,
    from: 0,
    to: 0,
    height: 0,
    looks: false,
  };

  const measure = (): void => {
    const box = band.getBoundingClientRect();
    roamMax = Math.max(
      EDGE_PX * 2,
      mouth.getBoundingClientRect().left - box.left - MOUTH_CLEAR_PX,
    );
    tufts.forEach((tuft, index) => {
      const r = tuft.getBoundingClientRect();
      tuftX[index] = r.left - box.left + r.width / 2;
    });
    driftHeight = drift.clientHeight;
    thingSize = things[0]?.el.offsetHeight ?? 0;
  };

  const setPose = (pose: RabbitPose): void => {
    if (bun.dataset.pose !== pose) bun.dataset.pose = pose;
  };
  /* The atlas faces left: -1 mirrors it to face right. */
  const setFacing = (): void => {
    bun.style.setProperty('--face', String(-hop.dir));
  };
  const place = (): void => {
    hopper.style.transform = `translate(${hop.x.toFixed(1)}px, ${hop.y.toFixed(1)}px)`;
  };

  const kick = (x: number): void => {
    tuftX.forEach((tx, index) => {
      if (Math.abs(tx - x) < WOBBLE_REACH_PX) tuftKick[index] = clock;
    });
    clodState.forEach((clod, index) => {
      const side = index - 1;
      clod.born = clock;
      clod.x = x + side * CLOD_SPREAD_PX;
      clod.vx = side * CLOD_SIDE_SPEED + random(-CLOD_JITTER, CLOD_JITTER);
      clod.vy = -random(CLOD_LIFT_MIN, CLOD_LIFT_MAX);
    });
  };

  const nextHop = (): void => {
    if (Math.random() < TURN_CHANCE) hop.dir = hop.dir === 1 ? -1 : 1;
    let to = hop.x + hop.dir * random(HOP_MIN_PX, HOP_MAX_PX);
    if (to < EDGE_PX || to > roamMax) {
      hop.dir = hop.dir === 1 ? -1 : 1;
      to = hop.x + hop.dir * random(HOP_MIN_PX, HOP_MAX_PX);
    }
    hop.from = hop.x;
    hop.to = clamp(to, EDGE_PX, roamMax);
    const distance = Math.abs(hop.to - hop.from);
    hop.height = Math.min(
      HOP_HEIGHT_MAX_PX,
      HOP_HEIGHT_MIN_PX + distance * HOP_HEIGHT_PER_PX,
    );
    hop.length = clamp(
      HOP_MS_BASE + distance * HOP_MS_PER_PX,
      HOP_MS_MIN,
      HOP_MS_MAX,
    );
    setFacing();
  };

  const stepRabbit = (): void => {
    const t = clock - hop.since;
    if (hop.phase === 'rest') {
      const looking =
        clock < lookUntil ||
        (hop.looks && t > hop.length * LOOK_FROM && t < hop.length * LOOK_TO);
      setPose(looking ? 'look' : 'sit');
      hop.y = 0;
      if (t >= hop.length && clock >= lookUntil) {
        hop.phase = 'crouch';
        hop.since = clock;
        nextHop();
      }
    } else if (hop.phase === 'crouch') {
      setPose('crouch');
      if (t >= CROUCH_MS) {
        hop.phase = 'air';
        hop.since = clock;
      }
    } else if (hop.phase === 'air') {
      const p = Math.min(1, t / hop.length);
      setPose('leap');
      hop.x = hop.from + (hop.to - hop.from) * p;
      hop.y = -hop.height * 4 * p * (1 - p);
      if (p >= 1) {
        hop.phase = 'land';
        hop.since = clock;
        hop.y = 0;
        kick(hop.x);
      }
    } else {
      setPose('crouch');
      if (t >= LAND_MS) {
        hop.phase = 'rest';
        hop.since = clock;
        hop.length = random(REST_MS_MIN, REST_MS_MAX);
        hop.looks = hop.length > LOOK_REST_MS;
      }
    }
    place();
  };

  const stepGrass = (): void => {
    tufts.forEach((tuft, index) => {
      const since = clock - (tuftKick[index] ?? -Infinity);
      const wobble =
        since < WOBBLE_MS
          ? WOBBLE_DEG *
            (1 - since / WOBBLE_MS) *
            Math.sin(since / WOBBLE_HZ_MS)
          : 0;
      const sway =
        SWAY_DEG *
        Math.sin(
          (clock / SWAY_PERIOD_MS) * Math.PI * 2 + index * SWAY_PHASE_STEP,
        );
      tuft.style.transform = `rotate(${(sway + wobble).toFixed(2)}deg)`;
    });
    clods.forEach((el, index) => {
      const clod = clodState[index];
      if (!clod) return;
      const age = clock - clod.born;
      if (age > CLOD_MS) {
        el.style.opacity = '0';
        return;
      }
      const x = clod.x + clod.vx * age;
      const y = Math.min(0, clod.vy * age + CLOD_GRAVITY * age * age);
      el.style.opacity = '1';
      el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) rotate(${(age / CLOD_SPIN_MS_PER_DEG).toFixed(0)}deg)`;
    });
  };

  const cycle = (): number => driftHeight + thingSize;

  /* `offset` is how far a thing has risen from just below the fall's floor. */
  const spread = (): void => {
    things.forEach((thing, index) => {
      thing.offset =
        driftHeight - FIRST_Y_PX + (index * cycle()) / things.length;
    });
  };

  const thingY = (thing: Thing): number => {
    const loop = cycle();
    const risen = thing.offset + (clock / 1000) * RISE_PX_PER_S;
    return driftHeight - (((risen % loop) + loop) % loop);
  };

  const jarThing = things.find((thing) => thing.el === jar);

  /* Puts the jar at `y` within the fall at the current clock. */
  const placeJar = (y: number): void => {
    if (!jarThing) return;
    jarThing.offset = driftHeight - y - (clock / 1000) * RISE_PX_PER_S;
  };

  /* How far the focus ring reaches past the jar's box: none when focus is not visible. */
  const ringReach = (): number => {
    const style = getComputedStyle(jar);
    if (style.outlineStyle === 'none') return 0;
    return parseFloat(style.outlineOffset) + parseFloat(style.outlineWidth);
  };

  /* A focused jar holds still with its ring wholly inside the fall, which clips, so focus never leaves sight (SC 2.4.11). */
  const holdFocusedJar = (): void => {
    if (!jarThing || !jar.matches(':focus-within')) return;
    const reach = ringReach();
    placeJar(clamp(thingY(jarThing), reach, driftHeight - thingSize - reach));
  };

  const drawThings = (): void => {
    things.forEach((thing) => {
      thing.el.style.transform = `translate3d(0, ${thingY(thing).toFixed(1)}px, 0)`;
      const turn = TURN_DEG * Math.sin((clock / thing.turnMs) * Math.PI * 2);
      thing.face.style.rotate = `${(thing.tilt + turn).toFixed(2)}deg`;
    });
  };

  const loop = createMotionLoop({
    maxFrameRate: MAX_FRAME_RATE,
    canRun: () => !paused,
    resume: (now) => {
      last = now;
    },
    frame: (now) => {
      const held = jarThing ? thingY(jarThing) : 0;
      clock += Math.min(MAX_DELTA_MS, now - last);
      last = now;
      if (jarThing && jar.matches(':focus-within')) placeJar(held);
      stepRabbit();
      stepGrass();
      drawThings();
      return NEXT_FRAME;
    },
    onReducedMotion: () => {
      show();
    },
  });

  const stopJar = (): void => {
    jarSpin.getAnimations().forEach((animation) => animation.cancel());
  };

  /* Timers keep counting on `clock`, so they are reset, not the clock: motion resumes from rest. */
  const still = (): void => {
    stopJar();
    hop.x = roamMax * HOME_SHARE;
    hop.y = 0;
    hop.dir = 1;
    hop.phase = 'rest';
    hop.since = clock;
    hop.length = FIRST_REST_MS;
    hop.looks = false;
    lookUntil = -1;
    tuftKick.fill(-Infinity);
    clodState.forEach((clod) => {
      clod.born = -Infinity;
    });
    setFacing();
    setPose('sit');
    place();
    tufts.forEach((tuft) => {
      tuft.style.transform = '';
    });
    clods.forEach((clod) => {
      clod.style.opacity = '0';
    });
    drawThings();
  };

  const state = (): 'running' | 'paused' =>
    !loop.reducedMotion() && !paused ? 'running' : 'paused';

  const show = (): void => {
    const reduced = loop.reducedMotion();
    band.dataset.homeMotion = state();
    pauses.forEach((button) => {
      if (reduced && button === document.activeElement) {
        document.querySelector('main')?.focus();
      }
      button.hidden = reduced;
      button.dataset.state = paused ? 'paused' : 'playing';
      const name = button.querySelector('[data-home-pause-name]');
      const glyph = button.querySelector('[data-home-pause-glyph]');
      if (name) name.textContent = paused ? PLAY_NAME : PAUSE_NAME;
      if (glyph) glyph.textContent = paused ? PLAY_GLYPH : PAUSE_GLYPH;
    });
    if (reduced) still();
  };

  const toggle = (): void => {
    paused = !paused;
    if (paused) {
      loop.stop();
      stopJar();
    } else {
      loop.start();
    }
    show();
  };

  /* Puts the tossed jar back just below the screen, so it rises into view. */
  const returnJar = (): void => {
    const top = drift.getBoundingClientRect().top;
    placeJar(Math.min(driftHeight, window.innerHeight - top));
  };

  /* Nothing moves while paused or under reduced motion: the jar flips over in place. */
  const pressJar = async (): Promise<void> => {
    if (tossing) return;
    tossing = true;
    try {
      if (paused || loop.reducedMotion()) {
        jar.dataset.flipped = '';
        await wait(FLIP_MS);
        delete jar.dataset.flipped;
        return;
      }
      lookUntil = clock + LOOK_UP_MS;
      const rise = jar.getBoundingClientRect().bottom + TOSS_CLEAR_PX;
      const toss = jarSpin.animate(
        [
          { transform: 'translateY(0) rotate(0deg)' },
          {
            transform: `translateY(${-rise}px) rotate(${TOSS_TURN_DEG}deg)`,
          },
        ],
        { duration: TOSS_MS, easing: TOSS_EASING, fill: 'forwards' },
      );
      try {
        await toss.finished;
        if (!jar.matches(':focus-within')) returnJar();
      } catch (error) {
        /* Cancelled by the pause control: the jar stays where it was. */
        if (!(error instanceof DOMException && error.name === 'AbortError')) {
          throw error;
        }
      }
      stopJar();
      drawThings();
    } finally {
      tossing = false;
    }
  };

  pauses.forEach((button) => {
    button.addEventListener('click', toggle);
  });
  jar.addEventListener('click', () => {
    void pressJar();
  });
  jar.addEventListener('focus', () => {
    holdFocusedJar();
    drawThings();
  });

  new ResizeObserver(() => {
    measure();
    hop.x = clamp(hop.x, EDGE_PX, roamMax);
    place();
    drawThings();
  }).observe(drift);

  hopper.style.left = '0px';
  things.forEach((thing) => {
    thing.el.style.top = '0px';
  });
  loop.connect();
  measure();
  spread();
  hop.x = roamMax * HOME_SHARE;
  setFacing();
  place();
  drawThings();
  show();
  loop.observe([band, drift], {
    rootMargin: VIEW_MARGIN,
    assumeOnScreen: true,
  });
  loop.start();
};

start();
