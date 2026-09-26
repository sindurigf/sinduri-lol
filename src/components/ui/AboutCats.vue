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
  type Colony,
} from '../../lib/about-cats';

/*
 * The cats render into `#cat-spot-<id>` on the page, only after mount: no
 * server HTML, so nothing moves or waits without JavaScript. Behaviour lives in
 * src/lib/about-cats.ts; this file owns the loop, the controls and the dialog.
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
const paused = ref(false);
const openId = ref<CatId | ''>('');
const dialog = useTemplateRef<HTMLDialogElement>('dialog');

const open = computed(() => props.cats.find((cat) => cat.id === openId.value));

const svgs = new Map<CatId, SVGSVGElement>();
let colony: Colony | null = null;
let frame = 0;
let onScreen = false;
let woken = false;
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
  mounted.value &&
  !reducedMotion.value &&
  !paused.value &&
  onScreen &&
  !document.hidden;

const tick = (now: number): void => {
  frame = 0;
  if (!colony || !running()) return;
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

const wake = (): void => {
  if (!colony || !running()) return;
  colony.wake(performance.now());
  start();
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
  if (!colony || !running()) return;
  const rects = new Map<CatId, DOMRect>();
  for (const [id, svg] of svgs) rects.set(id, svg.getBoundingClientRect());
  colony.pointer(event.clientX, event.clientY, performance.now(), rects);
};

const onVisibility = (): void => {
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
    wake();
  }
};

const toggle = (): void => {
  paused.value = !paused.value;
  if (!colony) return;
  if (paused.value) {
    stop();
    colony.pause();
  } else {
    wake();
  }
};

const openCat = (id: CatId): void => {
  openId.value = id;
  void nextTick(() => {
    if (dialog.value && !dialog.value.open) dialog.value.showModal();
  });
};

/* A click on the backdrop lands on the <dialog> itself. */
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
  colony = createColony(catSpots);
  layout();
  if (reducedMotion.value) colony.still();

  resizeObserver = new ResizeObserver(layout);
  viewObserver = new IntersectionObserver((entries) => {
    for (const entry of entries)
      entry.target.toggleAttribute('data-cat-visible', entry.isIntersecting);
    onScreen = spots().some((node) => node.hasAttribute('data-cat-visible'));
    if (!onScreen) {
      stop();
      return;
    }
    if (!woken) {
      woken = true;
      wake();
    } else {
      start();
    }
  });
  for (const node of spots()) {
    resizeObserver.observe(node);
    viewObserver.observe(node);
  }
  document.addEventListener('visibilitychange', onVisibility);
  document.addEventListener('pointermove', onPointer, { passive: true });
});

onBeforeUnmount(() => {
  stop();
  motionQuery?.removeEventListener('change', onPreferenceChange);
  resizeObserver?.disconnect();
  viewObserver?.disconnect();
  document.removeEventListener('visibilitychange', onVisibility);
  document.removeEventListener('pointermove', onPointer);
});
</script>

<template>
  <template v-if="mounted">
    <Teleport v-for="cat in cats" :key="cat.id" :to="`#cat-spot-${cat.id}`">
      <button
        type="button"
        class="cat-button"
        :data-cat="cat.id"
        aria-haspopup="dialog"
        @click="openCat(cat.id)"
        @focus="wake"
        @pointerover="wake"
      >
        <svg
          :ref="(node) => setSvg(cat.id, node)"
          class="cat-svg"
          aria-hidden="true"
          focusable="false"
        ></svg>
        <span class="sr-only">Meet {{ cat.name }}</span>
      </button>
      <button
        v-if="!reducedMotion"
        type="button"
        class="motion-toggle cat-motion-toggle"
        :data-cats-motion="paused ? 'paused' : 'running'"
        @click="toggle"
      >
        <span aria-hidden="true" class="text-label leading-none">{{
          paused ? '▶' : '❚❚'
        }}</span>
        <span class="sr-only">{{
          paused ? 'Play the cats' : 'Pause the cats'
        }}</span>
      </button>
    </Teleport>
  </template>

  <dialog
    ref="dialog"
    class="cat-dialog"
    :aria-labelledby="open ? `cat-dialog-${open.id}` : undefined"
    @close="openId = ''"
    @click="onDialogClick"
  >
    <div v-if="open" class="cat-dialog-body">
      <div
        class="aspect-frame aspect-square w-60 max-w-full border-4 border-border"
      >
        <img
          :src="open.photo.src"
          :srcset="open.photo.srcset"
          :width="open.photo.width"
          :height="open.photo.height"
          :alt="open.photo.alt"
        />
      </div>
      <div class="min-w-0">
        <h2 :id="`cat-dialog-${open.id}`" class="text-h3 text-text">
          {{ open.name }}
        </h2>
        <p class="mt-2 text-body text-subtle">{{ open.role }}</p>
        <p class="mt-4 max-w-prose text-body text-text">{{ open.about }}</p>
      </div>
    </div>
    <form method="dialog" class="mt-8 flex justify-end">
      <button class="btn-secondary">Close</button>
    </form>
  </dialog>
</template>
