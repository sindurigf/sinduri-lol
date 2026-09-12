<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';

/*
 * The spinning badge, with the pause control WCAG 2.2 SC 2.2.2 requires.
 *
 * The badge auto-starts, runs indefinitely and sits alongside other content,
 * which is the exact shape of the criterion. A `prefers-reduced-motion` query
 * does not satisfy it on its own, because someone who has not set the
 * preference still has no way to stop the motion.
 *
 * TWO THINGS HERE ARE DELIBERATE AND EASY TO "SIMPLIFY" AWAY.
 *
 * 1. NOTHING ANIMATES UNTIL THE ISLAND MOUNTS. The pause control is
 *    JavaScript, so an animation in the server-rendered HTML would run in a
 *    browser where this island failed to hydrate, with no control to stop it:
 *    motion with no mechanism, which is the failure the criterion names.
 *    Gating the animation on `mounted` makes the two arrive together or not
 *    at all, at the cost of a still badge for the first few hundred
 *    milliseconds.
 *
 * 2. THE BUTTON'S NAME CHANGES AND IT CARRIES NO `aria-pressed`. The comps do
 *    both, which states the state twice and lets the two contradict each
 *    other: "Play the spinning badge, pressed" is not a sentence anyone can
 *    act on. MobileMenu.vue makes the opposite choice for the same reason,
 *    keeping its name at "Menu" and letting `aria-expanded` carry the state.
 *    For a transport control the name is the stronger carrier, because "Play"
 *    and "Pause" say what the button will do, while "pressed" describes a
 *    toggle position that says nothing about whether anything is moving.
 */

const props = withDefaults(
  defineProps<{
    /** Which of the two durations in global.css to run at. */
    pace?: 'hero' | 'contact';
    /** Rendered size of the badge frame, in Tailwind size utilities. */
    frameClass?: string;
    /** Rendered size of the badge artwork, in Tailwind size utilities. */
    markClass?: string;
    /**
     * The frame's border weight. A prop rather than part of `frameClass`
     * because two border-width utilities on one element are resolved by their
     * order in the stylesheet, not in the class attribute, so overriding a
     * hardcoded default that way is a coin toss. The default is the comps'
     * 4px; the larger Contact badge passes 8px.
     */
    borderClass?: string;
    /** The hard offset shadow the frame carries, from the comps. */
    shadowClass?: string;
    /**
     * The white badge artwork, already optimised, from
     * src/lib/badge-image.ts.
     *
     * A prop rather than a constant here because `astro:assets` is a
     * build-time Astro API a `.vue` component cannot reach, and a plain Vite
     * import would content-hash the original PNG without converting it,
     * leaving the largest image on the site unoptimised.
     *
     * The suffix names the artwork colour, not the target surface: `-white`
     * is RGB(255,255,255) and measures 19.30 on the `deep` #0E0E0E frame,
     * where `-dark` would measure 1.02. See the asset table in ARCHITECTURE.md.
     *
     * Rendered with alt="" because the badge is decoration here: the header
     * wordmark and the footer copyright line already carry the site's name in
     * text, and a rotating element with a meaningful name would announce it a
     * third time.
     */
    badge: { src: string; srcset: string; width: number; height: number };
  }>(),
  {
    pace: 'hero',
    frameClass: 'h-32 w-32',
    markClass: 'w-24',
    borderClass: 'border-4',
    shadowClass: 'shadow-hard-cyan-8',
  },
);

const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';

const mounted = ref(false);
const reducedMotion = ref(false);
const paused = ref(false);

let query: MediaQueryList | null = null;

const onPreferenceChange = (event: MediaQueryListEvent): void => {
  reducedMotion.value = event.matches;
};

onMounted(() => {
  query = window.matchMedia(REDUCED_MOTION);
  reducedMotion.value = query.matches;
  query.addEventListener('change', onPreferenceChange);
  mounted.value = true;
});

onBeforeUnmount(() => {
  query?.removeEventListener('change', onPreferenceChange);
});

const toggle = (): void => {
  paused.value = !paused.value;
};
</script>

<template>
  <div class="relative inline-flex">
    <div
      class="flex items-center justify-center rounded-full border-border bg-deep"
      :class="[
        frameClass,
        borderClass,
        shadowClass,
        mounted && !reducedMotion ? ['spin-badge', `spin-pace-${pace}`] : [],
      ]"
      :data-paused="paused ? 'true' : 'false'"
    >
      <img
        :src="props.badge.src"
        :srcset="props.badge.srcset"
        alt=""
        :width="props.badge.width"
        :height="props.badge.height"
        class="h-auto"
        :class="markClass"
      />
    </div>

    <!--
      Rendered only while something is moving. A control that pauses nothing
      is worse than no control: one more stop in the tab order that changes
      nothing a reader can perceive.
    -->
    <button
      v-if="mounted && !reducedMotion"
      type="button"
      class="motion-toggle motion-toggle-corner"
      @click="toggle"
    >
      <span aria-hidden="true" class="text-label leading-none">{{
        paused ? '▶' : '❚❚'
      }}</span>
      <span class="sr-only">{{
        paused ? 'Play the spinning badge' : 'Pause the spinning badge'
      }}</span>
    </button>
  </div>
</template>
