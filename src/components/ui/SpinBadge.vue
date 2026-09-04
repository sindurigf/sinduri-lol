<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';

/*
 * The spinning badge, with the pause control WCAG 2.2 SC 2.2.2 requires.
 *
 * The badge auto-starts, runs indefinitely, and sits alongside other content,
 * which is the exact shape of the criterion: motion that begins automatically,
 * lasts more than five seconds, and is presented in parallel with other
 * content needs a mechanism to pause, stop or hide it. A
 * `prefers-reduced-motion` media query does not satisfy that on its own,
 * because someone who has not set the preference still has no way to stop it.
 *
 * TWO THINGS HERE ARE DELIBERATE AND EASY TO "SIMPLIFY" AWAY.
 *
 * 1. NOTHING ANIMATES UNTIL THE ISLAND MOUNTS. The pause control is
 *    JavaScript. If the animation were in the server-rendered HTML it would
 *    run in a browser where this island failed to hydrate, and the control
 *    that stops it would not exist — motion with no mechanism, which is the
 *    failure the criterion names. Gating the animation on `mounted` makes the
 *    two arrive together or not at all. The cost is that the badge is still
 *    for a few hundred milliseconds after load, which nobody notices.
 *
 * 2. THE BUTTON'S NAME CHANGES AND IT CARRIES NO `aria-pressed`. The comps do
 *    both: they flip `aria-pressed` and swap the label between "Pause" and
 *    "Play". That states the same thing twice and the two can contradict each
 *    other — "Play the spinning badge, pressed" is not a sentence anyone can
 *    act on. MobileMenu.vue makes the opposite choice for the same reason,
 *    keeping its name at "Menu" and letting `aria-expanded` carry the state.
 *    The state lives in exactly one place either way; which place is the right
 *    one depends on the control. For a transport control the name is the
 *    stronger carrier, because "Play" and "Pause" describe what the button
 *    will do, which is what a reader needs, while "pressed" describes a
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
    /** The hard offset shadow the frame carries, from the comps. */
    shadowClass?: string;
  }>(),
  {
    pace: 'hero',
    frameClass: 'h-32 w-32',
    markClass: 'w-24',
    shadowClass: 'shadow-hard-cyan-8',
  },
);

/*
 * The white badge artwork, on a `deep` #0E0E0E frame. The suffix names the
 * artwork colour rather than the target surface: `-white` is RGB(255,255,255)
 * and measures 19.30 on #0E0E0E, where `-dark` would measure 1.02 and be
 * invisible. See the asset table in AI.md.
 *
 * alt="" because the badge is decoration in this placement. It is not the only
 * carrier of the site's name anywhere it appears — the header wordmark and the
 * footer copyright line both say it in text — and a rotating element with a
 * meaningful accessible name would announce the name a third time.
 */
const BADGE = {
  src: '/images/badge-white.png',
  width: 760,
  height: 900,
} as const;

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
      class="flex items-center justify-center rounded-full border-4 border-border bg-deep"
      :class="[
        frameClass,
        shadowClass,
        mounted && !reducedMotion ? ['spin-badge', `spin-pace-${pace}`] : [],
      ]"
      :data-paused="paused ? 'true' : 'false'"
    >
      <img
        :src="BADGE.src"
        alt=""
        :width="BADGE.width"
        :height="BADGE.height"
        class="h-auto"
        :class="markClass"
      />
    </div>

    <!--
      Rendered only while something is actually moving. A control that pauses
      nothing is worse than no control: it is one more stop in the tab order
      that does not change anything a reader can perceive.
    -->
    <button
      v-if="mounted && !reducedMotion"
      type="button"
      class="motion-toggle"
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
