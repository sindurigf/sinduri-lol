/* Loops three takes on Minerva's sit-to-stand; a test page for one design round, never linked. */
const SCALE = 2;
/* Drawn heights in px at the site's size, before SCALE: sit 80, rise and stand from their widths on /about, the new ones on one shared scale. */
const FRAMES = {
  sit: 80,
  rise: 67.3,
  stand: 96.3,
  ib1: 90,
  ib2: 89,
  ib3: 85.5,
};
const TICK = 1000 / 12;
const HOLD = 1400;
/* Each step: frame, ms, x offset in px, squash x, squash y. */
const step = (frame, ms, x = 0, sx = 1, sy = 1) => ({ frame, ms, x, sx, sy });
/* A centers every drawing on one spot, as /about does; B and C place each so the head moves forward smoothly. */
const TAKES = {
  a: [step('sit', HOLD), step('rise', TICK), step('stand', HOLD)],
  b: [
    step('sit', HOLD),
    step('ib1', TICK, 2.8),
    step('ib2', TICK, 17.3),
    step('ib3', TICK, 23.7),
    step('stand', HOLD, 9.4),
  ],
  c: [
    step('sit', HOLD),
    step('sit', TICK, 0, 1.06, 0.92),
    step('rise', TICK, 8, 0.96, 1.05),
    step('rise', TICK, 10.6),
    step('stand', TICK, 9.4, 1.04, 0.95),
    step('stand', HOLD, 9.4),
  ],
};
/* Forward, then back down the same way. */
const loop = (take) => [...take, ...take.slice(1, -1).reverse()];

const draw = (img, s) => {
  img.src = `/cats-lab/${s.frame}.webp`;
  img.style.height = `${FRAMES[s.frame] * SCALE}px`;
  img.style.transform = `translateX(calc(-50% + ${s.x * SCALE}px)) scale(${s.sx}, ${s.sy})`;
};

const rows = [...document.querySelectorAll('img[data-row]')].map((img) => ({
  img,
  steps: loop(TAKES[img.dataset.row]),
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
    draw(row.img, row.steps[row.i]);
  }
  if (playing) requestAnimationFrame(tick);
};

const setPlaying = (on) => {
  playing = on;
  button.textContent = on ? 'Pause' : 'Play';
  button.setAttribute('aria-pressed', String(on));
  if (on) requestAnimationFrame(tick);
};

for (const row of rows) draw(row.img, row.steps[0]);
button.addEventListener('click', () => setPlaying(!playing));
setPlaying(playing);
