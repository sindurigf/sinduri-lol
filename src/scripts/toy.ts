/*
 * The footer stickers as toys: drag, toss and stack them inside their own
 * play area; tap one to pick it up and tap the tray to drop it (no dragging
 * needed, SC 2.5.7); or Tab to one and move it with the arrow keys. Play mode
 * pauses the stickers' links. Under reduced motion nothing is tossed.
 */
const REDUCED_MOTION = matchMedia('(prefers-reduced-motion: reduce)');
const STEP_PX = 16;
const BIG_STEP_PX = 48;
const FRICTION = 0.92;
const STOP_SPEED = 0.05;
const TOSS_MAX_MS = 900;
/* A press that moves less than this is a tap, not a drag. */
const TAP_PX = 6;
const KEYS: Readonly<Record<string, readonly [number, number]>> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
};

/* Placeholder copy: Sinduri rewrites every line below in her voice. */
const COPY = {
  reset: 'Put Them Back',
  tray: 'The box above is the tray: drag or drop stickers in it.',
  on: 'Play mode on. Drag a sticker, tap one and then the tray, or Tab to one and use the arrow keys.',
  off: 'Play mode off. The stickers are back and their links work again.',
  back: 'The stickers are back in place.',
  paused: 'Play mode: this link is paused.',
  held: 'Picked up. Tap the tray to drop it.',
  dropped: 'Dropped.',
};

const footer = document.querySelector('footer')!;
const toggle = footer.querySelector<HTMLButtonElement>('[data-toy-toggle]')!;
const list = footer.querySelector<HTMLElement>('.footer-stickers')!;
const items = [...list.querySelectorAll<HTMLElement>(':scope > li')];

const announcer = Object.assign(document.createElement('p'), {
  className: 'sr-only',
});
announcer.setAttribute('role', 'status');
footer.append(announcer);

const tray = Object.assign(document.createElement('div'), {
  className: 'toy-tray',
});
tray.setAttribute('aria-hidden', 'true');
/* Under the tray, out of the play area: a sticker never covers text. COPY.on says the same aloud. */
const trayHint = Object.assign(document.createElement('p'), {
  className: 'toy-tray-hint',
  textContent: COPY.tray,
});
trayHint.setAttribute('aria-hidden', 'true');
const paused = Object.assign(document.createElement('p'), {
  id: 'toy-paused',
  className: 'sr-only',
  textContent: COPY.paused,
});
const reset = Object.assign(document.createElement('button'), {
  type: 'button',
  className: 'btn-secondary toy-reset',
  textContent: COPY.reset,
});

let playing = false;
let top = 1;
let held: HTMLElement | null = null;
const spot = new Map<HTMLElement, { x: number; y: number }>();

const place = (item: HTMLElement, x: number, y: number): void => {
  spot.set(item, { x, y });
  item.style.setProperty('--toy-x', `${x}px`);
  item.style.setProperty('--toy-y', `${y}px`);
};

/* How far each way this sticker may go from home and stay in the play area. */
const bounds = (item: HTMLElement) => {
  const { x, y } = spot.get(item) ?? { x: 0, y: 0 };
  /* The sticker, not its list item: a tilt and an offset make it the larger box. */
  const box = item.firstElementChild!.getBoundingClientRect();
  const area = list.getBoundingClientRect();
  const floor = tray.getBoundingClientRect();
  const home = { left: box.left - x, top: box.top - y };
  return {
    minX: area.left - home.left,
    maxX: Math.max(area.right, floor.right) - box.width - home.left,
    minY: area.top - home.top,
    maxY: floor.bottom - box.height - home.top,
  };
};

const clamp = (item: HTMLElement, x: number, y: number) => {
  const b = bounds(item);
  return {
    x: Math.min(b.maxX, Math.max(b.minX, x)),
    y: Math.min(b.maxY, Math.max(b.minY, y)),
  };
};

const lift = (item: HTMLElement): void => {
  top += 1;
  item.style.zIndex = String(top);
};

const putBack = (): void => {
  items.forEach((item) => {
    place(item, 0, 0);
    item.style.removeProperty('z-index');
  });
};

const toss = (item: HTMLElement, vx: number, vy: number): void => {
  if (REDUCED_MOTION.matches) return;
  const started = performance.now();
  let last = started;
  let speedX = vx;
  let speedY = vy;
  const step = (now: number): void => {
    const dt = now - last;
    last = now;
    const { x, y } = spot.get(item)!;
    const next = clamp(item, x + speedX * dt, y + speedY * dt);
    if (next.x !== x + speedX * dt) speedX = -speedX;
    if (next.y !== y + speedY * dt) speedY = -speedY;
    place(item, next.x, next.y);
    speedX *= FRICTION;
    speedY *= FRICTION;
    if (
      playing &&
      Math.hypot(speedX, speedY) > STOP_SPEED &&
      now - started < TOSS_MAX_MS
    )
      requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
};

items.forEach((item) => {
  const sticker = item.querySelector<HTMLElement>('.footer-sticker')!;
  sticker.addEventListener('click', (event) => {
    if (playing) event.preventDefault();
  });
  sticker.addEventListener('pointerdown', (event) => {
    if (!playing) return;
    event.preventDefault();
    sticker.setPointerCapture(event.pointerId);
    lift(item);
    const start = spot.get(item) ?? { x: 0, y: 0 };
    const from = { x: event.clientX, y: event.clientY };
    let trail = [{ x: event.clientX, y: event.clientY, t: event.timeStamp }];
    const move = (moved: PointerEvent): void => {
      const next = clamp(
        item,
        start.x + moved.clientX - from.x,
        start.y + moved.clientY - from.y,
      );
      place(item, next.x, next.y);
      trail = [
        ...trail,
        { x: moved.clientX, y: moved.clientY, t: moved.timeStamp },
      ].slice(-4);
    };
    const drop = (up: PointerEvent): void => {
      sticker.removeEventListener('pointermove', move);
      if (Math.hypot(up.clientX - from.x, up.clientY - from.y) < TAP_PX) {
        hold(held === item ? null : item);
        return;
      }
      const first = trail[0]!;
      const last = trail.at(-1)!;
      const dt = Math.max(1, last.t - first.t);
      toss(item, (last.x - first.x) / dt, (last.y - first.y) / dt);
    };
    sticker.addEventListener('pointermove', move);
    sticker.addEventListener('pointerup', drop, { once: true });
    sticker.addEventListener('pointercancel', drop, { once: true });
  });
  sticker.addEventListener('keydown', (event) => {
    if (!playing) return;
    if (event.key === 'Enter') {
      event.preventDefault();
      return;
    }
    const direction = KEYS[event.key];
    if (!direction) return;
    event.preventDefault();
    lift(item);
    const size = event.shiftKey ? BIG_STEP_PX : STEP_PX;
    const { x, y } = spot.get(item) ?? { x: 0, y: 0 };
    const next = clamp(item, x + direction[0] * size, y + direction[1] * size);
    place(item, next.x, next.y);
  });
});

const say = (text: string): void => {
  announcer.textContent = text;
};

function hold(item: HTMLElement | null): void {
  held?.removeAttribute('data-held');
  held = item;
  if (item) {
    item.setAttribute('data-held', '');
    lift(item);
    say(COPY.held);
  }
}

/* A tap on the tray drops the held sticker there, centered on the tap. */
tray.addEventListener('pointerdown', (event) => {
  if (!held) return;
  const box = held.firstElementChild!.getBoundingClientRect();
  const { x, y } = spot.get(held) ?? { x: 0, y: 0 };
  const next = clamp(
    held,
    x + event.clientX - (box.left + box.width / 2),
    y + event.clientY - (box.top + box.height / 2),
  );
  place(held, next.x, next.y);
  hold(null);
  say(COPY.dropped);
});

reset.addEventListener('click', () => {
  putBack();
  say(COPY.back);
});

const setPlaying = (on: boolean): void => {
  playing = on;
  footer.toggleAttribute('data-toy', on);
  toggle.setAttribute('aria-pressed', String(on));
  items.forEach((item) => {
    const sticker = item.firstElementChild!;
    if (on) {
      sticker.setAttribute('aria-disabled', 'true');
      sticker.setAttribute('aria-describedby', paused.id);
    } else {
      sticker.removeAttribute('aria-disabled');
      sticker.removeAttribute('aria-describedby');
    }
  });
  if (on) {
    list.after(tray, trayHint, reset, paused);
  } else {
    hold(null);
    putBack();
    trayHint.remove();
    tray.remove();
    reset.remove();
    paused.remove();
  }
  say(on ? COPY.on : COPY.off);
};

toggle.addEventListener('on-demand', () => setPlaying(!playing));

export {};
