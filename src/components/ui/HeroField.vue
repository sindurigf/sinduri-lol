<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, useTemplateRef } from 'vue';
import {
  createHeroField,
  type HeroField,
  type HeroPalette,
} from '../../lib/hero-field';

/*
 * The homepage hero's field, and the pause control WCAG 2.2 SC 2.2.2 requires.
 *
 * This component owns three canvases, one animation frame and one button.
 * Everything it draws lives in src/lib/hero-field.ts, along with the
 * reasoning about projection, stem density and the springs.
 *
 * NOTHING ANIMATES UNTIL THIS ISLAND MOUNTS, the same rule SpinBadge.vue
 * follows and for the same reason: the pause control is JavaScript, so a
 * server-rendered field would animate in a browser where this island failed
 * to hydrate, with no control to stop it. Gating both on `mounted` makes them
 * arrive together or not at all. With scripting off the canvases render empty
 * and the hero is the name and the two stickers on a flat ground.
 *
 * UNDER `prefers-reduced-motion` THE FIELD IS STILL DRAWN, ONCE, AND HELD.
 * Hiding it would take the artwork from people who asked for less movement,
 * not less picture. The frame is painted at a fixed time so the composition
 * is the same on every load, and no button is rendered, because a control
 * that pauses nothing is one more stop in the tab order.
 *
 * THE CANVASES ARE `aria-hidden` AND CARRY NO ALT TEXT. The field is
 * decoration and says nothing the heading does not.
 *
 * THE COLOURS ARE READ FROM THE STYLESHEET, NOT NAMED HERE.
 * `scripts/check-tokens.mjs` fails the build on a raw hex in a `.vue` or
 * `.ts` file: a copied palette drifts. Reading the live custom properties
 * also means the field follows a retoned token without knowing it changed.
 */

/** The frame drawn when motion is off. Any fixed number; this one sits mid-hop. */
const STILL_SECONDS = 3.4;

/**
 * Backing-store scale ceiling. A 3x phone would otherwise allocate nine times
 * the pixels of a 1x screen across three full-viewport canvases and repaint
 * all of it every frame, for line work no one can see past 2x.
 */
const MAX_PIXEL_RATIO = 2;

/**
 * The field is drawn at most thirty times a second, whatever the display
 * offers.
 *
 * Every drawn frame repaints three full-viewport canvases, which on a machine
 * with no GPU is main-thread work that grows with the screen and can make
 * each frame a long task of its own. Measured at 1350x940 with no CPU
 * throttling, main-thread time on the field was about 300ms a second at 60
 * drawn frames and about 156ms at 30.
 *
 * Thirty is enough for this motion: the wind is two slow sines, and the
 * fastest hop in `HOPS` covers 228 reference units in 0.88 seconds, under
 * nine units between drawn frames.
 *
 * `FRAME_SLACK_MS` lets a frame through slightly early. Animation frames
 * arrive with jitter, and a strict 33.3ms gate on a 60Hz display would
 * sometimes miss by a fraction and wait a whole extra frame, stuttering down
 * to 20.
 */
const MAX_FRAME_RATE = 30;
const FRAME_INTERVAL_MS = 1000 / MAX_FRAME_RATE;
const FRAME_SLACK_MS = 4;

/**
 * Longest step the springs will integrate, so a stalled tab does not fold them
 * in half. Two frame intervals: it has to sit clear of an ordinary frame, or
 * every step would be clipped short and the whole field would run slow.
 */
const MAX_DELTA = 2 / MAX_FRAME_RATE;

/** Resize settles before anything is regenerated; a drag fires this continuously. */
const RESIZE_DEBOUNCE = 150;

const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';

const host = useTemplateRef<HTMLDivElement>('host');
const backCanvas = useTemplateRef<HTMLCanvasElement>('back');
const midCanvas = useTemplateRef<HTMLCanvasElement>('mid');
const nearCanvas = useTemplateRef<HTMLCanvasElement>('near');

const mounted = ref(false);
const reducedMotion = ref(false);
const paused = ref(false);

let field: HeroField | null = null;
let frame = 0;
/** Accumulated running time. Pausing stops adding to it rather than resetting it. */
let elapsed = 0;
let lastFrame = 0;
/** Device pixels per CSS pixel, capped. The field itself draws in CSS pixels. */
let ratio = 1;
let onScreen = true;
let resizeTimer = 0;
/** The box `relayout` last sized the canvases to, in CSS pixels. */
let boxWidth = 0;
let boxHeight = 0;

let motionQuery: MediaQueryList | null = null;
let resizeObserver: ResizeObserver | null = null;
let viewObserver: IntersectionObserver | null = null;

const readPalette = (): HeroPalette | null => {
  const style = getComputedStyle(document.documentElement);
  const read = (token: string): string => style.getPropertyValue(token).trim();
  const palette: HeroPalette = {
    border: read('--color-border'),
    text: read('--color-text'),
    subtle: read('--color-subtle'),
    muted: read('--color-muted'),
    background: read('--color-background'),
  };
  /*
   * If the tokens are not there the stylesheet has not arrived, and drawing in
   * whatever the canvas defaults to would put black-on-black shapes over the
   * hero. Better to render nothing and let the next resize try again.
   */
  return Object.values(palette).every((value) => value.length > 0)
    ? palette
    : null;
};

/** Size one canvas to the box, in device pixels. */
const prepare = (
  canvas: HTMLCanvasElement | null,
  width: number,
  height: number,
): void => {
  if (!canvas) return;
  canvas.width = Math.max(1, Math.round(width * ratio));
  canvas.height = Math.max(1, Math.round(height * ratio));
};

const contextOf = (
  canvas: HTMLCanvasElement | null,
): CanvasRenderingContext2D | null => {
  const ctx = canvas?.getContext('2d') ?? null;
  if (!ctx) return null;
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  return ctx;
};

const draw = (seconds: number): void => {
  if (!field) return;
  /*
   * The box `relayout` laid the field out in, not `clientWidth` again: read
   * here it is a layout query every frame, and straight after `relayout` has
   * resized the canvases it can force a synchronous one. The backing stores
   * only change size in `relayout`, so its numbers are the ones every frame
   * has to agree with.
   */
  const width = boxWidth;
  const height = boxHeight;
  if (width < 1 || height < 1) return;

  const back = contextOf(backCanvas.value);
  const mid = contextOf(midCanvas.value);
  const near = contextOf(nearCanvas.value);
  if (!back || !mid || !near) return;

  back.clearRect(0, 0, width, height);
  mid.clearRect(0, 0, width, height);
  near.clearRect(0, 0, width, height);

  field.back(back, seconds);
  field.mid(mid, seconds);
  /* Out of focus through the canvas's own CSS filter, which `relayout` sets. */
  field.near(near, seconds);
};

const tick = (now: number): void => {
  frame = 0;
  if (!field) return;
  /*
   * An animation frame that arrives before the next drawn frame is due only
   * asks for another. See `MAX_FRAME_RATE`.
   */
  if (now - lastFrame >= FRAME_INTERVAL_MS - FRAME_SLACK_MS) {
    const delta = Math.min(MAX_DELTA, Math.max(0, (now - lastFrame) / 1000));
    lastFrame = now;
    elapsed += delta;
    field.step(elapsed, delta);
    draw(elapsed);
  }
  if (running()) frame = requestAnimationFrame(tick);
};

const running = (): boolean =>
  mounted.value && !reducedMotion.value && !paused.value && onScreen;

const start = (): void => {
  if (frame || !running()) return;
  lastFrame = performance.now();
  frame = requestAnimationFrame(tick);
};

const stop = (): void => {
  if (!frame) return;
  cancelAnimationFrame(frame);
  frame = 0;
};

/** Rebuild for the current box. Called on mount, on resize, and when motion is turned off. */
const relayout = (): void => {
  if (!field || !host.value) return;
  const width = host.value.clientWidth;
  const height = host.value.clientHeight;
  if (width < 1 || height < 1) return;
  boxWidth = width;
  boxHeight = height;

  ratio = Math.min(MAX_PIXEL_RATIO, window.devicePixelRatio || 1);

  prepare(backCanvas.value, width, height);
  prepare(midCanvas.value, width, height);
  prepare(nearCanvas.value, width, height);

  /*
   * The field draws in CSS pixels and works out its own proportions from the
   * box, so this is the only place the two have to agree. See the note at the
   * top of hero-field.ts.
   */
  field.layout(width, height);

  /*
   * DEPTH OF FIELD IS A CSS FILTER ON THE NEAR CANVAS, NOT `ctx.filter`.
   *
   * Blurring through an offscreen canvas on every frame made each frame a
   * long task of about 450ms on a throttled phone profile, nearly all of it
   * Chrome producing canvas resources; sizing that canvas once per resize
   * changed nothing. With the blur on the element the same trace ran 241
   * frames in 4 seconds. The radius is identical: the canvas blur was
   * `nearBlur() * ratio` device pixels, which is `nearBlur()` CSS pixels.
   *
   * Set here because the radius shrinks with the projection, and through the
   * CSSOM rather than a `:style` binding. A binding is server-rendered as a
   * `style` attribute, which `style-src` in the CSP refuses.
   */
  if (nearCanvas.value) {
    nearCanvas.value.style.filter = `blur(${field.nearBlur()}px)`;
  }

  /*
   * ALWAYS REDRAW. Setting a canvas's size clears it, so skipping this while
   * an animation frame is pending leaves the field blank until that frame
   * lands, and a frame can be very late in headless WebKit, which is what CI
   * reported as an empty middle canvas. The cost is one extra paint per
   * settled resize.
   */
  draw(currentSeconds());
};

const currentSeconds = (): number =>
  reducedMotion.value ? STILL_SECONDS : elapsed;

const onResize = (): void => {
  window.clearTimeout(resizeTimer);
  resizeTimer = window.setTimeout(relayout, RESIZE_DEBOUNCE);
};

const onPreferenceChange = (event: MediaQueryListEvent): void => {
  reducedMotion.value = event.matches;
  if (reducedMotion.value) {
    stop();
    /* Springs go back to rest, so the held frame is the same one every time. */
    elapsed = STILL_SECONDS;
    relayout();
  } else {
    start();
  }
};

const onVisibility = (): void => {
  if (document.hidden) stop();
  else start();
};

const toggle = (): void => {
  paused.value = !paused.value;
  if (paused.value) stop();
  else start();
};

onMounted(() => {
  const palette = readPalette();
  if (!palette) return;

  field = createHeroField(palette);

  motionQuery = window.matchMedia(REDUCED_MOTION);
  reducedMotion.value = motionQuery.matches;
  motionQuery.addEventListener('change', onPreferenceChange);

  mounted.value = true;
  elapsed = reducedMotion.value ? STILL_SECONDS : 0;
  relayout();

  if (host.value && 'ResizeObserver' in window) {
    resizeObserver = new ResizeObserver(onResize);
    resizeObserver.observe(host.value);
  } else {
    window.addEventListener('resize', onResize);
  }

  /*
   * Scrolled past, the field stops. It is the tallest thing on the page and
   * nobody is looking at it once the first section has gone by.
   */
  if (host.value && 'IntersectionObserver' in window) {
    viewObserver = new IntersectionObserver(
      (entries) => {
        onScreen = entries.some((entry) => entry.isIntersecting);
        if (onScreen) start();
        else stop();
      },
      { rootMargin: '120px' },
    );
    viewObserver.observe(host.value);
  }

  document.addEventListener('visibilitychange', onVisibility);
  start();
});

onBeforeUnmount(() => {
  stop();
  window.clearTimeout(resizeTimer);
  motionQuery?.removeEventListener('change', onPreferenceChange);
  resizeObserver?.disconnect();
  viewObserver?.disconnect();
  window.removeEventListener('resize', onResize);
  document.removeEventListener('visibilitychange', onVisibility);
});
</script>

<template>
  <!--
    `data-hero-motion` is the only way anything outside this component can
    tell whether the field is moving: a canvas has no `animation-play-state`
    to read, so tests/motion.spec.ts would otherwise assert against a class
    name, which keeps passing after the thing it stands for has broken. It is
    written from the same predicate the animation frame is gated on, so the
    two cannot disagree.
  -->
  <div
    ref="host"
    class="hero-field"
    :data-hero-motion="
      mounted && !reducedMotion && !paused ? 'running' : 'paused'
    "
  >
    <canvas ref="back" aria-hidden="true" class="hero-field-layer"></canvas>
    <canvas ref="mid" aria-hidden="true" class="hero-field-layer"></canvas>
    <canvas ref="near" aria-hidden="true" class="hero-field-layer"></canvas>

    <button
      v-if="mounted && !reducedMotion"
      type="button"
      class="motion-toggle hero-motion-toggle"
      @click="toggle"
    >
      <span aria-hidden="true" class="text-label leading-none">{{
        paused ? '▶' : '❚❚'
      }}</span>
      <span class="sr-only">{{
        paused ? 'Play the hero animation' : 'Pause the hero animation'
      }}</span>
    </button>
  </div>
</template>
