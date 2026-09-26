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
  type Hold,
} from '../../lib/about-cats';

/*
 * The cats render into `#cat-spot-<id>` on the page, only after mount: no
 * server HTML, so nothing moves or waits without JavaScript. Each cat is its
 * own SC 2.2.2 control: a click stops it and opens its card, and wakes it again.
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
const asleep = ref<Partial<Record<CatId, boolean>>>({});
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
  mounted.value && !reducedMotion.value && onScreen && !document.hidden;

const opensCard = (id: CatId): boolean =>
  reducedMotion.value || !asleep.value[id];

const label = (cat: CatInfo): string => {
  if (reducedMotion.value) return `Meet ${cat.name}`;
  return asleep.value[cat.id]
    ? `Wake ${cat.name}`
    : `Stop and meet ${cat.name}`;
};

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

const wakeAll = (): void => {
  if (!colony || !running()) return;
  colony.wakeAll(performance.now());
  start();
};

const hold = (id: CatId, reason: Hold, on: boolean): void => {
  colony?.hold(id, reason, on);
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
  start();
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
    wakeAll();
  }
};

/* `close` fires a task later, so a quick second cat can open before it lands. */
let shownFor: CatId | '' = '';

const afterClose = (): void => {
  const id = shownFor;
  shownFor = '';
  if (!id || !colony || reducedMotion.value) return;
  colony.nap(id);
  start();
};

const openCat = (id: CatId): void => {
  if (shownFor && !dialog.value?.open) afterClose();
  shownFor = id;
  openId.value = id;
  void nextTick(() => {
    if (dialog.value && !dialog.value.open) dialog.value.showModal();
  });
};

const onCatClick = (id: CatId): void => {
  if (!opensCard(id)) {
    colony?.wake(id, performance.now());
    start();
    return;
  }
  if (!reducedMotion.value) hold(id, 'card', true);
  openCat(id);
};

const onDialogClose = (): void => {
  if (dialog.value?.open) return;
  openId.value = '';
  afterClose();
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
  colony = createColony(catSpots, (id, isAsleep) => {
    asleep.value = { ...asleep.value, [id]: isAsleep };
  });
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
      wakeAll();
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
        :aria-haspopup="opensCard(cat.id) ? 'dialog' : undefined"
        @click="onCatClick(cat.id)"
        @focus="hold(cat.id, 'focus', true)"
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
  </dialog>
</template>
