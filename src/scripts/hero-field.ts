/*
 * The homepage meadow: sizes the three canvases in `[data-hero-field]` and
 * runs the frame loop; drawing lives in src/lib/hero-field.ts. The pause
 * control (SC 2.2.2) ships `hidden` and shows once motion can run, so one
 * never ships without the other. Reduced motion draws one fixed frame and
 * keeps the button hidden.
 */
import { NEXT_FRAME, createMotionLoop } from './motion-loop';
import { requiredElementIn } from './required-element';
import { createHeroField } from '../lib/hero-field';
import { MAX_PIXEL_RATIO } from '../lib/image-densities';
import type { HeroField, HeroPalette } from '../lib/hero-field-scene';
import heroRabbit from '../assets/hero-rabbit.svg';
import heroRabbitLight from '../assets/hero-rabbit-light.svg';

/** Any fixed time; this one falls in the hare's first rest. */
const STILL_SECONDS = 3.4;

/* Each frame repaints three canvases, so 60fps would double main-thread cost for motion this slow. */
const MAX_FRAME_RATE = 30;

/** Caps a stalled tab's step; must exceed one frame interval or the field runs slow. */
const MAX_DELTA = 2 / MAX_FRAME_RATE;

const RESIZE_DEBOUNCE = 150;
const VIEW_MARGIN = '120px';

/** Longest wait for an idle moment before the rabbit joins the field. */
const ATLAS_IDLE_MS = 1000;

const LABEL_PAUSE = 'Pause the hero animation';
const LABEL_PLAY = 'Play the hero animation';
const GLYPH_PAUSE = '❚❚';
const GLYPH_PLAY = '▶';

const required = requiredElementIn('hero-field');

const setUp = (host: HTMLElement): void => {
  const [backCanvas, midCanvas, nearCanvas] =
    host.querySelectorAll<HTMLCanvasElement>('canvas.hero-field-layer');
  if (!backCanvas || !midCanvas || !nearCanvas)
    throw new Error('hero-field: three canvas.hero-field-layer are missing.');
  const button = required(host, '.hero-motion-toggle', HTMLButtonElement);
  const glyph = required(button, '[aria-hidden="true"]', HTMLSpanElement);
  const label = required(button, '.sr-only', HTMLSpanElement);

  let field: HeroField | null = null;
  let atlas: HTMLImageElement | null = null;
  let paused = false;
  let elapsed = 0;
  let lastStep = 0;
  let ratio = 1;
  let resizeTimer = 0;
  let boxWidth = 0;
  let boxHeight = 0;
  /* Matches only the current ratio, so it is re-armed after every change. */
  let resolution: MediaQueryList | null = null;

  /* From the host, not the root: light mode sets these tokens on <main>. */
  const readPalette = (): HeroPalette | null => {
    const style = getComputedStyle(host);
    const read = (token: string): string =>
      style.getPropertyValue(token).trim();
    const required = {
      stalk: read('--color-hero-stalk'),
      background: read('--color-background'),
      shadow: read('--color-block-ink'),
    };
    const missing = Object.entries(required)
      .filter(([, value]) => value.length === 0)
      .map(([name]) => name);
    if (missing.length === 0)
      return { ...required, fill: read('--color-hero-fill') };
    /* Draw nothing rather than black on black. */
    console.error(`Hero field not drawn: no color for ${missing.join(', ')}.`);
    return null;
  };

  const prepare = (canvas: HTMLCanvasElement): void => {
    canvas.width = Math.max(1, Math.round(boxWidth * ratio));
    canvas.height = Math.max(1, Math.round(boxHeight * ratio));
  };

  const contextOf = (
    canvas: HTMLCanvasElement,
  ): CanvasRenderingContext2D | null => {
    const ctx = canvas.getContext('2d');
    ctx?.setTransform(ratio, 0, 0, ratio, 0, 0);
    return ctx;
  };

  const draw = (seconds: number): void => {
    /* Cached, not `clientWidth`: reading it per frame forces layout. */
    if (!field || boxWidth < 1 || boxHeight < 1) return;
    const back = contextOf(backCanvas);
    const mid = contextOf(midCanvas);
    const near = contextOf(nearCanvas);
    if (!back || !mid || !near) return;

    back.clearRect(0, 0, boxWidth, boxHeight);
    mid.clearRect(0, 0, boxWidth, boxHeight);
    near.clearRect(0, 0, boxWidth, boxHeight);

    field.back(back, seconds);
    field.mid(mid, seconds);
    /* Out of focus through the canvas's own CSS filter, which `relayout` sets. */
    field.near(near, seconds);
  };

  const tick = (now: number): number => {
    if (field) {
      const delta = Math.min(MAX_DELTA, Math.max(0, (now - lastStep) / 1000));
      lastStep = now;
      elapsed += delta;
      field.step(elapsed, delta);
      draw(elapsed);
    }
    return NEXT_FRAME;
  };

  const showState = (reduced: boolean): void => {
    button.hidden = reduced;
    glyph.textContent = paused ? GLYPH_PLAY : GLYPH_PAUSE;
    label.textContent = paused ? LABEL_PLAY : LABEL_PAUSE;
    /* A canvas has no animation-play-state; tests/motion.spec.ts reads this. */
    host.dataset.heroMotion = reduced || paused ? 'paused' : 'running';
  };

  const relayout = (): void => {
    if (!field) return;
    const width = host.clientWidth;
    const height = host.clientHeight;
    if (width < 1 || height < 1) return;
    boxWidth = width;
    boxHeight = height;
    ratio = Math.min(MAX_PIXEL_RATIO, window.devicePixelRatio || 1);

    prepare(backCanvas);
    prepare(midCanvas);
    prepare(nearCanvas);
    field.layout(width, height);

    /* CSS filter, not `ctx.filter`: canvas blur blows the frame budget on a throttled phone. */
    nearCanvas.style.filter = `blur(${field.nearBlur()}px)`;

    /* Always redraw: resizing clears the canvas, and the next frame can be late in headless WebKit. */
    draw(loop.reducedMotion() ? STILL_SECONDS : elapsed);
  };

  const onReducedMotion = (reduced: boolean): void => {
    /* The button hides; focus on it moves to <main> rather than being dropped (SC 2.4.3). */
    if (reduced && document.activeElement === button)
      host.closest<HTMLElement>('main')?.focus();
    showState(reduced);
    if (!reduced) return;
    elapsed = STILL_SECONDS;
    relayout();
  };

  const loop = createMotionLoop({
    frame: tick,
    resume: (now) => {
      lastStep = now;
    },
    canRun: () => !paused && field !== null,
    maxFrameRate: MAX_FRAME_RATE,
    onReducedMotion,
  });

  /*
   * ResizeObserver also fires on focus and subpixel reflow; a rebuild snaps every
   * bent stem straight and flakes tests/motion.spec.ts. Only rebuild on a real change.
   */
  const onResize = (): void => {
    if (host.clientWidth === boxWidth && host.clientHeight === boxHeight)
      return;
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(relayout, RESIZE_DEBOUNCE);
  };

  /*
   * A denser screen or a zoom that keeps the box's CSS size resizes nothing, so
   * ResizeObserver misses it; the backing store must follow the new ratio.
   */
  const watchRatio = (): void => {
    resolution?.removeEventListener('change', onRatioChange);
    resolution = window.matchMedia(
      `(resolution: ${window.devicePixelRatio}dppx)`,
    );
    resolution.addEventListener('change', onRatioChange);
  };

  function onRatioChange(): void {
    watchRatio();
    relayout();
  }

  /* Stems are built in their colors, so a new palette needs a new field. */
  const rebuild = (): void => {
    const palette = readPalette();
    if (!palette) return;
    field = createHeroField(palette, atlas);
    relayout();
  };

  /* The field draws without the rabbit until the atlas decodes, then rebuilds with it. */
  const atlasSrc = (): string =>
    document.documentElement.dataset.theme === 'light'
      ? heroRabbitLight.src
      : heroRabbit.src;
  const loadAtlas = (): void => {
    const image = new Image();
    image.src = atlasSrc();
    image
      .decode()
      .then(() => {
        if (image.src !== new URL(atlasSrc(), location.href).href) return;
        atlas = image;
        /* The first draw rasterises the vector atlas, tens of ms: when the page is idle, not mid-load. */
        if (typeof window.requestIdleCallback === 'function')
          window.requestIdleCallback(rebuild, { timeout: ATLAS_IDLE_MS });
        else setTimeout(rebuild, 0);
      })
      .catch((error: unknown) => {
        console.error('The hero rabbit image did not load.', error);
      });
  };

  button.addEventListener('click', () => {
    paused = !paused;
    showState(loop.reducedMotion());
    if (paused) loop.stop();
    else loop.start();
  });

  const palette = readPalette();
  if (!palette) return;
  field = createHeroField(palette, atlas);
  loadAtlas();

  loop.connect();
  elapsed = loop.reducedMotion() ? STILL_SECONDS : 0;
  showState(loop.reducedMotion());
  relayout();

  new ResizeObserver(onResize).observe(host);
  loop.observe([host], { rootMargin: VIEW_MARGIN, assumeOnScreen: true });
  watchRatio();
  /* Watches data-theme itself, so the hero imports nothing from the switch's module. */
  const onTheme = (): void => {
    if (atlas && atlas.src !== new URL(atlasSrc(), location.href).href)
      loadAtlas();
    rebuild();
  };
  new MutationObserver(onTheme).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme'],
  });
  loop.start();
};

setUp(required(document, '[data-hero-field]', HTMLElement));
