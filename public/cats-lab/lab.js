/* Loops takes on two of Minerva's moves; a test page for one design round, never linked. */
const SCALE = 2;
const TICK = 1000 / 12;
const HOLD = 1400;
/* px the body moves per walk drawing on /about: one stride of 52 over 8 drawings. */
const STRIDE_STEP = 6.5;
/* Today's trot in px a second, and the most walk drawings /about advances in one step. */
const TROT_SPEED = 110;
const MAX_WALK_STEP = 2;
/* Drawn heights in px at /about's size, before SCALE, and each drawing's front paw as a share of its width. */
/* Each walk drawing's front paw as a share of its width, measured from the drawings. */
const WALK_PAW = { walk: 0.003, walk2: 0.248, walk3: 0.187, walk4: 0.251, walk5: 0, walk6: 0.169, walk7: 0.172, walk8: 0.066 };
const FRAMES = {
  sit: { h: 80, paw: 0.2 },
  headturn: { h: 80, paw: 0.312 },
  rise: { h: 67.3, paw: 0.269 },
  stand: { h: 96.3, paw: 0.132 },
  ib1: { h: 90, paw: 0.229 },
  /* The tail tip hangs below ib2's paws, so it is drawn this far down to stand on them. */
  ib2: { h: 89, paw: 0.29, dy: 2.2 },
  ib3: { h: 85.5, paw: 0.167 },
  ...Object.fromEntries(
    ['walk', 'walk2', 'walk3', 'walk4', 'walk5', 'walk6', 'walk7', 'walk8'].map(
      (f) => [f, { h: 67.2, paw: WALK_PAW[f] ?? 0 }],
    ),
  ),
};
/* D's heights: every drawing at the walk's scale, where /about draws sit and stand larger than the walk. */
const MATCHED = { sit: 72, headturn: 72, ib1: 72, ib2: 71.2, ib3: 68.4, stand: 77 };
const WIDTH = {};
const WALK = ['walk', 'walk2', 'walk3', 'walk4', 'walk5', 'walk6', 'walk7', 'walk8'];

/* frame, ms, x in px (site size), squash x and y, height override, and whether x is the front paw (planted) or the center. */
const step = (frame, ms, x = 0, o = {}) => ({ frame, ms, x, sx: 1, sy: 1, ...o });

/* D: side-on sit before the rise, front paws planted, about 0.5 s up and 0.6 s down, hind end lowering first. */
const matched = (frame, ms, x, o = {}) =>
  step(frame, ms, x, { paw: true, h: MATCHED[frame], ...o });
/* px back that keeps ib3's front leg over ib2's: its leftmost pixel is a toe raised off the floor. */
const IB3_NUDGE = -3;
const D_SIT_STAND = [
  matched('sit', HOLD, 0),
  matched('headturn', 700, 0),
  matched('ib1', 100, 0, { sx: 1.02, sy: 0.97 }),
  matched('ib2', 140, 0),
  matched('ib3', 140, IB3_NUDGE),
  matched('stand', 120, 0, { sx: 1.02, sy: 0.97 }),
  matched('stand', HOLD, 0),
  matched('ib3', 140, IB3_NUDGE),
  matched('ib2', 180, 0),
  matched('ib1', 120, 0, { sx: 1.03, sy: 0.96 }),
  matched('ib1', 140, 0),
  matched('headturn', 700, 0),
];

/* A: /about today, each drawing centered on one spot, one tick for the in-between. */
const A_SIT_STAND = [
  step('sit', HOLD),
  step('rise', TICK),
  step('stand', HOLD),
  step('rise', TICK),
];

const B_SIT_STAND = [
  step('sit', HOLD, 0, { h: 90 }),
  step('ib1', TICK, 2.8),
  step('ib2', TICK, 17.3),
  step('ib3', TICK, 23.7),
  step('stand', HOLD, 9.4),
  step('ib3', TICK, 23.7),
  step('ib2', TICK, 17.3),
  step('ib1', TICK, 2.8),
];

const C_SIT_STAND = [
  step('sit', HOLD),
  step('sit', TICK, 0, { sx: 1.06, sy: 0.92 }),
  step('rise', TICK, 8, { sx: 0.96, sy: 1.05 }),
  step('rise', TICK, 10.6),
  step('stand', TICK, 9.4, { sx: 1.04, sy: 0.95 }),
  step('stand', HOLD, 9.4),
  step('rise', TICK, 10.6),
];

/* Walk start and stop over the same distance; the cat walks left, then the loop starts again. */
const WALK_FROM = 39;
const WALK_FRAMES = 11;

/*
 * D: each walk drawing moves the body by the distance that keeps its planted paw on the same spot,
 * measured from the drawings' ground contacts (site px, negative is forward). Starts and ends on walk3,
 * whose stance matches the stand; slower first and last steps, and a settle.
 */
const PLANTED_STEP = {
  walk: -3.9,
  walk2: -13.4,
  walk3: -5,
  walk4: -2.8,
  walk5: -3.1,
  walk6: -5.6,
  walk7: -4.1,
  walk8: -3.1,
};
const D_WALK_FIRST = 2;
const D_WALK_FRAMES = 9;
const WALK_WIDTH = 80.8;
const pawOf = (frame, center) =>
  center - WALK_WIDTH / 2 + FRAMES[frame].paw * WALK_WIDTH;
const dWalk = () => {
  const frames = Array.from(
    { length: D_WALK_FRAMES },
    (_, i) => WALK[(D_WALK_FIRST + i) % WALK.length],
  );
  const centers = [WALK_FROM];
  frames.slice(0, -1).forEach((f, i) => centers.push(centers[i] + PLANTED_STEP[f]));
  /* Standing, her front paws sit where the first and last walk drawings put theirs. */
  const stand = (ms, x, o = {}) =>
    step('stand', ms, x, { h: MATCHED.stand, paw: true, ...o });
  const steps = [stand(HOLD, pawOf(frames[0], centers[0]))];
  frames.forEach((f, i) => {
    const ms = i === 0 ? 160 : i === 1 ? 120 : i === frames.length - 1 ? 120 : TICK;
    steps.push(step(f, ms, centers[i]));
  });
  const end = pawOf(frames.at(-1), centers.at(-1));
  steps.push(stand(120, end, { sx: 1.02, sy: 0.97 }), stand(HOLD, end));
  return steps;
};

/* A: today's trot at TROT_SPEED; the drawing steps at most MAX_WALK_STEP and jumps to the body. */
const aWalk = () => {
  const steps = [step('stand', HOLD, WALK_FROM)];
  const distance = STRIDE_STEP * (WALK_FRAMES + 1);
  let shown = 0;
  for (let t = TICK; ; t += TICK) {
    const travelled = Math.min(distance, (TROT_SPEED * t) / 1000);
    const wanted = Math.floor(travelled / STRIDE_STEP);
    shown = Math.min(wanted, shown + MAX_WALK_STEP);
    steps.push(step(WALK[shown % WALK.length], TICK, WALK_FROM - travelled));
    if (travelled >= distance) break;
  }
  steps.push(step('stand', HOLD, WALK_FROM - distance));
  return steps;
};

const TAKES = {
  d: D_SIT_STAND,
  a: A_SIT_STAND,
  b: B_SIT_STAND,
  c: C_SIT_STAND,
  dw: dWalk(),
  aw: aWalk(),
};

const place = (img, s) => {
  const f = FRAMES[s.frame];
  const h = (s.h ?? f.h) * SCALE;
  const src = `/cats-lab/${s.frame}.webp`;
  /* Setting the same src again makes the browser decode it anew, which can blank a frame. */
  if (img.getAttribute('src') !== src) img.src = src;
  img.style.height = `${h}px`;
  const w = WIDTH[s.frame] ? (WIDTH[s.frame] * h) / 100 : 0;
  /* Planted: the front paw sits at x; otherwise the drawing's center does. */
  const from = s.paw ? -f.paw * w : -w / 2;
  const dy = (f.dy ?? 0) * (h / (f.h * SCALE)) * SCALE;
  img.style.transform = `translate(${from + s.x * SCALE}px, ${dy}px) scale(${s.sx}, ${s.sy})`;
  img.style.transformOrigin = s.paw ? `${f.paw * w}px 100%` : '50% 100%';
};

const rows = [...document.querySelectorAll('img[data-row]')].map((img) => ({
  img,
  steps: TAKES[img.dataset.row],
  i: 0,
  at: 0,
}));
const button = document.getElementById('play');
let playing = !matchMedia('(prefers-reduced-motion: reduce)').matches;

const tick = (now) => {
  for (const row of rows) {
    if (now - row.at < row.steps[row.i].ms) continue;
    row.i = (row.i + 1) % row.steps.length;
    row.at = now;
    place(row.img, row.steps[row.i]);
  }
  if (playing) requestAnimationFrame(tick);
};

const setPlaying = (on) => {
  playing = on;
  button.textContent = on ? 'Pause' : 'Play';
  if (on) requestAnimationFrame(tick);
};

/* Width per 100 px of height, read once each drawing loads, so placement needs no layout reads per frame. */
const loadAll = Object.keys(FRAMES).map(
  (f) =>
    new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        WIDTH[f] = (img.naturalWidth / img.naturalHeight) * 100;
        resolve();
      };
      img.onerror = () => reject(new Error(`cats-lab: ${f}.webp did not load.`));
      img.src = `/cats-lab/${f}.webp`;
    }),
);
Promise.all(loadAll).then(() => {
  for (const row of rows) place(row.img, row.steps[0]);
  button.addEventListener('click', () => setPlaying(!playing));
  setPlaying(playing);
}, reportError);
