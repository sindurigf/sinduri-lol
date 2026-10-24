/*
 * The footer rabbit's climb onto the Let It Fall heap in the hero atlas's poses: crouch,
 * leap on an arc, crouch, sit. Decorative and aria-hidden; let-it-fall.ts picks each landing.
 */
import {
  ATLAS_SIZE,
  RABBIT_FRAMES,
  type RabbitPose,
} from '../lib/hero-field-rabbit';

export type Foot = { x: number; y: number };

/* ms: a hop's flight, its crouches, the breath between hops and each glance on top. */
const HOP_MS = 400;
const CROUCH_MS = 110;
const LAND_MS = 90;
const BREATH_MS = 120;
const LOOK_MS = 520;
const GLANCES = 2;
/* px of arc above the higher end of a hop, plus this share of the climb. */
const ARC = 46;
const CLIMB_ARC_SHARE = 0.35;
/* Squash at takeoff and landing, stretch in the air, as scale x and y. */
const CROUCH_SQUASH = [1.08, 0.86];
const LAND_SQUASH = [1.1, 0.84];
const AIR_STRETCH = [0.94, 1.08];
const AIR_STRETCH_SHARE = 0.4;

/* Atlas px each pose draws below its feet: its sticker edge and block. */
const SOLE = Math.max(
  ...Object.values(RABBIT_FRAMES).map((frame) => frame.h - frame.footY),
);

/* A new fall, Put It Back or a stop cancels a running move on purpose; anything else is a real error. */
export const ignoreCancel = (error: unknown): void => {
  if (!(error instanceof DOMException && error.name === 'AbortError')) {
    reportError(error);
  }
};

const wait = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));
const easeInOut = (t: number) => 0.5 - Math.cos(Math.PI * t) / 2;

export const createHopper = (sticker: HTMLImageElement, atlasUrl: string) => {
  const host = sticker.offsetParent;
  if (!(host instanceof HTMLElement)) {
    throw new Error('let-it-fall: the footer rabbit has no positioned parent.');
  }
  const feet = document.createElement('span');
  const squash = document.createElement('span');
  const frame = document.createElement('span');
  const atlas = document.createElement('img');
  feet.className = 'fall-hopper';
  feet.setAttribute('aria-hidden', 'true');
  frame.className = 'fall-hopper-frame';
  atlas.alt = '';
  atlas.src = atlasUrl;
  frame.append(atlas);
  squash.append(frame);
  feet.append(squash);

  let run = 0;
  let scale = 1;
  let at: Foot = { x: 0, y: 0 };
  /* Where it is drawn now, mid-flight included. */
  let shown: Foot = { x: 0, y: 0 };
  /* The atlas faces left. */
  let facingLeft = true;

  /* Viewport points to the host's own coordinates, which scroll with the page. */
  const local = ({ x, y }: Foot): Foot => {
    const origin = host.getBoundingClientRect();
    return { x: x - origin.left, y: y - origin.top };
  };
  const place = ({ x, y }: Foot) => {
    shown = { x, y };
    feet.style.setProperty(
      'transform',
      `translate(${x}px, ${y}px) scaleX(${facingLeft ? 1 : -1})`,
    );
  };
  const pose = (name: RabbitPose) => {
    const f = RABBIT_FRAMES[name];
    frame.style.setProperty('left', `${-f.footX * scale}px`);
    frame.style.setProperty('top', `${-f.footY * scale}px`);
    frame.style.setProperty('width', `${f.w * scale}px`);
    frame.style.setProperty('height', `${f.h * scale}px`);
    atlas.style.setProperty('left', `${-f.x * scale}px`);
    atlas.style.setProperty('top', `${-f.y * scale}px`);
  };
  /* Held in its style once played, so no finished animation lingers. */
  const squashTo = async ([x, y]: number[], duration: number) => {
    const to = `scale(${x}, ${y})`;
    await squash.animate([{ transform: to }], { duration, easing: 'ease-out' })
      .finished;
    squash.style.setProperty('transform', to);
  };
  const flight = (from: Foot, to: Foot, height: number, mine: number) =>
    new Promise<void>((resolve) => {
      const start = performance.now();
      const tick = (now: number) => {
        if (mine !== run) return resolve();
        const t = Math.min(1, (now - start) / HOP_MS);
        const u = easeInOut(t);
        place({
          x: from.x + (to.x - from.x) * u,
          y: from.y + (to.y - from.y) * u - height * 4 * u * (1 - u),
        });
        if (t < 1) requestAnimationFrame(tick);
        else resolve();
      };
      requestAnimationFrame(tick);
    });

  const hop = async (to: Foot, mine: number) => {
    if (to.x !== at.x) facingLeft = to.x < at.x;
    place(at);
    pose('crouch');
    await squashTo(CROUCH_SQUASH, CROUCH_MS);
    if (mine !== run) return;
    pose('leap');
    squashTo(AIR_STRETCH, HOP_MS * AIR_STRETCH_SHARE).catch(ignoreCancel);
    const climb = Math.max(0, at.y - to.y);
    await flight(at, to, ARC + climb * CLIMB_ARC_SHARE, mine);
    if (mine !== run) return;
    at = to;
    place(at);
    pose('crouch');
    await squashTo(LAND_SQUASH, LAND_MS);
    if (mine !== run) return;
    await squashTo([1, 1], LAND_MS);
    if (mine !== run) return;
    pose('sit');
  };

  const lookAround = async (mine: number) => {
    for (let glance = 0; glance < GLANCES && mine === run; glance++) {
      pose('look');
      await wait(LOOK_MS);
      if (mine !== run) return;
      facingLeft = !facingLeft;
      place(at);
      pose('sit');
      await wait(LOOK_MS);
    }
  };

  const home = (): Foot => {
    const box = sticker.getBoundingClientRect();
    return local({ x: box.left + box.width / 2, y: box.bottom - SOLE * scale });
  };

  const stop = () => {
    run++;
    for (const animation of squash.getAnimations()) animation.cancel();
    squash.style.removeProperty('transform');
    feet.remove();
    feet.removeAttribute('data-settled');
    sticker.removeAttribute('data-away');
  };

  return {
    local,
    stop,
    /* Leaves the sticker for the hopper and climbs the stones, in the host's coordinates from `local`, to the last; `size` scales the sitting rabbit. */
    async climb(stones: Foot[], size: number) {
      const mine = ++run;
      await atlas.decode();
      if (mine !== run) return;
      scale =
        (sticker.getBoundingClientRect().height / RABBIT_FRAMES.sit.h) * size;
      atlas.style.setProperty('width', `${ATLAS_SIZE.w * scale}px`);
      atlas.style.setProperty('height', `${ATLAS_SIZE.h * scale}px`);
      at = home();
      facingLeft = true;
      pose('sit');
      place(at);
      host.append(feet);
      sticker.setAttribute('data-away', '');
      for (const stone of stones) {
        await hop({ x: stone.x, y: stone.y - SOLE * scale }, mine);
        if (mine !== run) return;
        await wait(BREATH_MS);
      }
      await lookAround(mine);
      if (mine === run) feet.setAttribute('data-settled', '');
    },
    /* One leap home, since the heap climbs home under it at once; then the sticker is back. */
    async goHome() {
      const mine = ++run;
      feet.removeAttribute('data-settled');
      for (const animation of squash.getAnimations()) animation.cancel();
      /* From wherever it is, mid-flight included. */
      at = shown;
      if (feet.isConnected) await hop(home(), mine);
      if (mine === run) stop();
    },
  };
};

export type Hopper = ReturnType<typeof createHopper>;
