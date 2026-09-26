<script setup lang="ts">
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  useTemplateRef,
} from 'vue';
import { createCatRig, type CatId } from '../../lib/about-cats-rig';
import {
  createColony,
  type CatInfo,
  type CatSpot,
  type CatMood,
  type Colony,
  type Hold,
} from '../../lib/about-cats';

/*
 * The cats render into `#cat-spot-<id>` on the page, only after mount: no
 * server HTML, so nothing moves or waits without JavaScript. Each cat is its
 * own SC 2.2.2 control: closing its card puts a playing cat to sleep or wakes it.
 */

const props = defineProps<{ cats: CatInfo[] }>();

/* Where each cat starts on its card, 0 to 1, and which way it faces. */
const PLACES: Record<CatId, { start: number; facing: 1 | -1 }> = {
  minerva: { start: 0.85, facing: -1 },
  hela: { start: 0.8, facing: -1 },
  rudra: { start: 0.8, facing: -1 },
};

const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';

const mounted = ref(false);
const reducedMotion = ref(false);
const moods = ref<Partial<Record<CatId, CatMood>>>({});
const openId = ref<CatId | ''>('');
const dialog = useTemplateRef<HTMLDialogElement>('dialog');

const open = computed(() => props.cats.find((cat) => cat.id === openId.value));

const svgs = new Map<CatId, SVGSVGElement>();
let colony: Colony | null = null;
let frame = 0;
let onScreen = false;
let pointerAt: { x: number; y: number; time: number } | null = null;
let motionQuery: MediaQueryList | null = null;
let resizeObserver: ResizeObserver | null = null;
let viewObserver: IntersectionObserver | null = null;

const setSvg = (id: CatId, node: unknown): void => {
  if (node instanceof SVGSVGElement) svgs.set(id, node);
};

const spots = (): HTMLElement[] =>
  props.cats
    .map((cat) => document.getElementById(`cat-spot-${cat.id}`))
    .filter((node): node is HTMLElement => node !== null);

const running = (): boolean =>
  mounted.value && !reducedMotion.value && onScreen && !document.hidden;

const asleep = (id: CatId): boolean => moods.value[id] === 'asleep';

const label = (cat: CatInfo): string => {
  if (reducedMotion.value) return `Meet ${cat.name}`;
  return asleep(cat.id)
    ? `Meet and wake ${cat.name}`
    : `Stop and meet ${cat.name}`;
};

/* Rects are read here, once a frame before drawing, not on every pointermove. */
const feedPointer = (): void => {
  if (!colony || !pointerAt) return;
  const rects = new Map<CatId, DOMRect>();
  for (const [id, svg] of svgs) rects.set(id, svg.getBoundingClientRect());
  colony.pointer(pointerAt.x, pointerAt.y, pointerAt.time, rects);
  pointerAt = null;
};

const tick = (now: number): void => {
  frame = 0;
  if (!colony || !running()) return;
  feedPointer();
  if (colony.frame(now)) frame = requestAnimationFrame(tick);
};

const start = (): void => {
  if (frame || !running()) return;
  frame = requestAnimationFrame(tick);
};

const stop = (): void => {
  if (!frame) return;
  cancelAnimationFrame(frame);
  frame = 0;
};

const hold = (id: CatId, reason: Hold, on: boolean): void => {
  colony?.hold(id, reason, on);
  start();
};

/*
 * Only keyboard focus holds a cat still. Not `:focus-visible`: WebKit matches it
 * when a dialog closed by mouse hands focus back to the button.
 */
let keyboardLast = false;
const onKeyDown = (): void => {
  keyboardLast = true;
};
const onPointerDown = (): void => {
  keyboardLast = false;
};

const onFocus = (id: CatId): void => {
  if (keyboardLast) hold(id, 'focus', true);
};

const spotId = (node: Element): CatId | undefined =>
  props.cats.find((cat) => node.id === `cat-spot-${cat.id}`)?.id;

/** Each cat's play clock runs only while its own band is on screen. */
const showSpot = (node: Element, on: boolean): void => {
  const id = spotId(node);
  if (!id || !colony || reducedMotion.value) return;
  colony.visible(id, on, performance.now());
};

const layout = (): void => {
  if (!colony) return;
  const sizes = new Map<CatId, { width: number; height: number }>();
  for (const cat of props.cats) {
    const svg = svgs.get(cat.id);
    if (!svg) continue;
    const width = svg.clientWidth;
    const height = svg.clientHeight;
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    sizes.set(cat.id, { width, height });
  }
  colony.layout(sizes);
};

const onPointer = (event: PointerEvent): void => {
  if (!colony || !running() || !colony.watching()) return;
  pointerAt = { x: event.clientX, y: event.clientY, time: performance.now() };
  start();
};

/* A background tab is off screen too, so it does not use up play time. */
const onVisibility = (): void => {
  for (const node of spots())
    showSpot(node, !document.hidden && node.hasAttribute('data-cat-visible'));
  if (document.hidden) stop();
  else start();
};

const onPreferenceChange = (event: MediaQueryListEvent): void => {
  reducedMotion.value = event.matches;
  if (!colony) return;
  if (reducedMotion.value) {
    stop();
    colony.still();
  } else {
    for (const node of spots())
      showSpot(node, node.hasAttribute('data-cat-visible'));
    start();
  }
};

/* `close` fires a task later, so a quick second cat can open before it lands. */
let shownFor: CatId | '' = '';
/* What the button promised when the card opened: close then wakes, or naps. */
let wakeOnClose = false;

const afterClose = (): void => {
  const id = shownFor;
  shownFor = '';
  if (!id || !colony) return;
  if (reducedMotion.value) {
    colony.hold(id, 'card', false);
    return;
  }
  colony.release(id, performance.now(), wakeOnClose);
  start();
};

const openCat = (id: CatId): void => {
  if (shownFor && !dialog.value?.open) afterClose();
  shownFor = id;
  wakeOnClose = asleep(id);
  openId.value = id;
  void nextTick(() => {
    if (dialog.value && !dialog.value.open) dialog.value.showModal();
  });
};

const onCatClick = (id: CatId): void => {
  if (!reducedMotion.value) hold(id, 'card', true);
  openCat(id);
};

const onDialogClose = (): void => {
  if (dialog.value?.open) return;
  openId.value = '';
  afterClose();
};

/* The dialog has no padding or border, so only a backdrop click lands on it. */
const onDialogClick = (event: MouseEvent): void => {
  if (event.target === dialog.value) dialog.value?.close();
};

onMounted(async () => {
  motionQuery = window.matchMedia(REDUCED_MOTION);
  reducedMotion.value = motionQuery.matches;
  motionQuery.addEventListener('change', onPreferenceChange);
  mounted.value = true;
  await nextTick();

  const catSpots: CatSpot[] = [];
  for (const cat of props.cats) {
    const svg = svgs.get(cat.id);
    if (!svg) continue;
    const propLayer = document.createElementNS(
      'http://www.w3.org/2000/svg',
      'g',
    );
    svg.append(propLayer);
    const rig = createCatRig(svg, cat.id);
    catSpots.push({ id: cat.id, rig, props: propLayer, ...PLACES[cat.id] });
  }
  colony = createColony(catSpots, (id, mood) => {
    moods.value = { ...moods.value, [id]: mood };
  });
  layout();
  if (reducedMotion.value) colony.still();

  resizeObserver = new ResizeObserver(layout);
  viewObserver = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      entry.target.toggleAttribute('data-cat-visible', entry.isIntersecting);
      showSpot(entry.target, entry.isIntersecting);
    }
    onScreen = spots().some((node) => node.hasAttribute('data-cat-visible'));
    if (onScreen) start();
    else stop();
  });
  for (const node of spots()) {
    resizeObserver.observe(node);
    viewObserver.observe(node);
  }
  document.addEventListener('visibilitychange', onVisibility);
  document.addEventListener('pointermove', onPointer, { passive: true });
  document.addEventListener('keydown', onKeyDown, { capture: true });
  document.addEventListener('pointerdown', onPointerDown, { capture: true });
});

onBeforeUnmount(() => {
  stop();
  motionQuery?.removeEventListener('change', onPreferenceChange);
  resizeObserver?.disconnect();
  viewObserver?.disconnect();
  document.removeEventListener('visibilitychange', onVisibility);
  document.removeEventListener('pointermove', onPointer);
  document.removeEventListener('keydown', onKeyDown, { capture: true });
  document.removeEventListener('pointerdown', onPointerDown, {
    capture: true,
  });
});
</script>

<template>
  <template v-if="mounted">
    <Teleport v-for="cat in cats" :key="cat.id" :to="`#cat-spot-${cat.id}`">
      <button
        type="button"
        class="cat-button"
        :data-cat="cat.id"
        :data-cat-state="moods[cat.id] ?? 'playing'"
        aria-haspopup="dialog"
        @click="onCatClick(cat.id)"
        @focus="onFocus(cat.id)"
        @blur="hold(cat.id, 'focus', false)"
        @pointerenter="hold(cat.id, 'pointer', true)"
        @pointerleave="hold(cat.id, 'pointer', false)"
      >
        <svg
          :ref="(node) => setSvg(cat.id, node)"
          class="cat-svg"
          aria-hidden="true"
          focusable="false"
        ></svg>
        <span class="sr-only">{{ label(cat) }}</span>
      </button>
    </Teleport>
  </template>

  <dialog
    ref="dialog"
    class="cat-dialog"
    :aria-labelledby="open ? `cat-dialog-${open.id}` : undefined"
    @close="onDialogClose"
    @click="onDialogClick"
  >
    <div class="cat-card">
      <div v-if="open" class="cat-dialog-body">
        <div class="aspect-frame aspect-square w-full border-4 border-border">
          <img
            :src="open.photo.src"
            :srcset="open.photo.srcset"
            :width="open.photo.width"
            :height="open.photo.height"
            :alt="open.photo.alt"
          />
        </div>
        <h2 :id="`cat-dialog-${open.id}`" class="mt-4 text-h3 text-text">
          {{ open.name }}
        </h2>
        <p class="mt-1 text-body text-subtle">{{ open.role }}</p>
      </div>
      <form method="dialog" class="mt-4 flex justify-end">
        <button class="btn-secondary">Close</button>
      </form>
    </div>
  </dialog>
</template>
