<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue';
import { CTA, NAV_LINKS, isActive as isCurrentPage } from '../../lib/nav';

const props = defineProps<{ currentPath: string }>();

/*
 * Native <dialog> with showModal(). The browser traps focus, moves focus into
 * the dialog on open, closes on Escape, restores focus to the trigger on
 * close, marks the rest of the page inert and renders ::backdrop. No
 * focus-trap library, and no keydown handler of our own.
 */
const dialog = ref<HTMLDialogElement | null>(null);
const isOpen = ref(false);

const isActive = (href: string): boolean =>
  isCurrentPage(props.currentPath, href);

/*
 * A modal dialog does not reliably stop the page behind it from scrolling.
 *
 * Hiding the overflow also removes a classic scrollbar, and everything behind
 * the menu then reflows that much wider: 15px in headed Chromium, measured
 * 2026-09-18. The body is padded by the scrollbar's width for as long as the
 * lock holds, read before the lock takes it away. With overlay scrollbars the
 * width is 0 and nothing changes. `scrollbar-gutter: stable` would do the same
 * in CSS, but headless Chromium reserves the gutter with no scrollbar drawn,
 * which narrows the 288px box the heading floors are calibrated against.
 */
const lockScroll = (locked: boolean): void => {
  const scrollbar = window.innerWidth - document.documentElement.clientWidth;
  document.body.style.paddingRight =
    locked && scrollbar > 0 ? `${scrollbar}px` : '';
  document.body.style.overflow = locked ? 'hidden' : '';
};

const open = (): void => {
  if (!dialog.value) return;
  dialog.value.showModal();
  isOpen.value = true;
  lockScroll(true);
};

const close = (): void => {
  // Always go through close() so the browser restores focus to the trigger.
  dialog.value?.close();
};

/*
 * The single source of truth for the closed state. Escape and the backdrop
 * close the dialog without going through close(), so aria-expanded and the
 * scroll lock are reset here rather than in the click handler.
 */
const onClose = (): void => {
  isOpen.value = false;
  lockScroll(false);
};

/*
 * Keep the focused control, and its focus ring, inside the scrolled panel.
 * Chromium scrolls a partly visible control into view on focus; Firefox 153
 * scrolls only one that is fully out of view, so tabbing to a control at the
 * edge left it and its ring cut off (SC 2.4.7). `nearest` fixes that, and in
 * Chromium and Firefox respects the panel's scroll-padding. WebKit's does not:
 * it stops with the control flush against the edge, which drew the Close
 * button's ring off screen in CI. So the ring's own reach is read from its
 * style and the panel is nudged by whatever is still cut off. The room to
 * nudge into is `.mobile-menu-content`'s bottom padding.
 */
const keepInView = (event: FocusEvent): void => {
  const control = event.target as HTMLElement | null;
  const panel = dialog.value;
  if (!control || !panel) return;

  control.scrollIntoView({ block: 'nearest' });

  const style = getComputedStyle(control);
  const reach =
    parseFloat(style.outlineWidth) + parseFloat(style.outlineOffset);
  if (!Number.isFinite(reach) || reach <= 0) return;

  const box = control.getBoundingClientRect();
  const edge = panel.getBoundingClientRect();
  const below = box.bottom + reach - edge.bottom;
  const above = edge.top - (box.top - reach);
  // Rounded up: scrollTop settles on whole pixels, and a box edge need not.
  if (below > 0) panel.scrollTop += Math.ceil(below);
  else if (above > 0) panel.scrollTop -= Math.ceil(above);
};

onBeforeUnmount(() => {
  lockScroll(false);
});
</script>

<template>
  <div class="mobile-menu-island md:hidden">
    <!--
      The name stays "Menu" in both states. aria-expanded already announces
      collapsed/expanded, so flipping the name to "Close menu" would duplicate
      the state into the name and can contradict what is announced.
    -->
    <button
      type="button"
      class="flex h-12 w-12 items-center justify-center border-4 border-border bg-surface"
      :aria-expanded="isOpen"
      aria-controls="mobile-menu-panel"
      aria-label="Menu"
      @click="open"
    >
      <span aria-hidden="true" class="relative block h-4 w-6">
        <span
          class="absolute left-0 block h-menu-bar w-6 bg-gold transition-transform duration-150"
          :class="isOpen ? 'top-menu-bar-mid rotate-45' : 'top-0'"
        />
        <span
          class="absolute left-0 top-menu-bar-mid block h-menu-bar w-6 bg-gold transition-opacity duration-150"
          :class="isOpen ? 'opacity-0' : 'opacity-100'"
        />
        <span
          class="absolute left-0 block h-menu-bar w-6 bg-gold transition-transform duration-150"
          :class="isOpen ? 'top-menu-bar-mid -rotate-45' : 'top-menu-bar-end'"
        />
      </span>
    </button>

    <dialog
      id="mobile-menu-panel"
      ref="dialog"
      class="mobile-menu-dialog"
      aria-label="Menu"
      @close="onClose"
      @focusin="keepInView"
    >
      <!--
        Deliberately unnamed. The dialog around it is named "Menu", which is
        the context a screen reader announces on entry. aria-label="Primary"
        here would duplicate the header nav's label, leaving two landmarks
        reading "Primary, navigation" with nothing to tell them apart
        (landmark-unique, SC 1.3.1), and any other name would invent a second
        name for the same links.

        The dialog is named with aria-label rather than a visually hidden
        heading, because an sr-only <h2> here would sit ahead of the page's
        <h1> in source order and corrupt the document outline.
      -->
      <div class="mobile-menu-content">
        <nav>
          <ul class="flex flex-col gap-8">
            <!--
            The same active treatment as the desktop nav: a bordered box with
            the site's offset gold shadow, the border present but transparent
            on every link, so becoming current changes colour and shadow
            rather than geometry. These are stacked, so a border appearing on
            one item would shift every item below it. `aria-current="page"` is
            what announces the state.
          -->
            <li v-for="link in NAV_LINKS" :key="link.href">
              <a
                :href="link.href"
                :aria-current="isActive(link.href) ? 'page' : undefined"
                class="block border-4 px-4 py-2 font-black uppercase tracking-heading-tight"
                :class="
                  isActive(link.href)
                    ? 'lift-control border-border text-text shadow-hard-pink-4'
                    : 'border-transparent text-text hover:text-cyan'
                "
                @click="close"
              >
                {{ link.label }}
              </a>
            </li>
          </ul>

          <a
            :href="CTA.href"
            :aria-current="isActive(CTA.href) ? 'page' : undefined"
            class="nav-cta mt-12 block px-8 py-5 text-center"
            @click="close"
          >
            {{ CTA.label }}
          </a>
        </nav>

        <button type="button" class="btn-secondary mt-12 w-full" @click="close">
          Close
        </button>
      </div>
    </dialog>
  </div>
</template>

<style scoped>
/*
 * A <dialog> is display: none until opened and centred in the top layer by
 * default, so it is reset to the full-bleed panel this design wants. Sizing
 * stays in the component: dialog mechanics, not a token.
 */
.mobile-menu-dialog {
  max-width: none;
  max-height: none;
  width: 100%;
  height: 100%;
  margin: 0;
  padding: 2.5rem 1.5rem 0;
  border: 0;
  background-color: var(--color-background);
  color: var(--color-text);
  overflow-y: auto;
  /*
   * Room for a focus ring when the browser scrolls a focused link to the edge:
   * the ring, its gap, and the current link's shadow it clears. Without it the
   * ring is clipped (SC 2.4.7).
   */
  scroll-padding-block: calc(
    var(--focus-width) + var(--focus-gap) + var(--lift-control)
  );
}

/*
 * The space below the Close button lives inside the content rather than in
 * the dialog's own bottom padding, so there is always room below the last
 * control for keepInView to scroll its focus ring clear of the edge. Padding
 * on a child is part of that child's box, which every engine scrolls to.
 */
.mobile-menu-content {
  padding-bottom: 2.5rem;
}

/*
 * When the content overflows, the dialog itself becomes a tab stop. It fills
 * the viewport, so the site's outward ring would land off screen. Draw it
 * inside the edge instead.
 */
.mobile-menu-dialog:focus-visible {
  outline-offset: calc(-1 * (var(--focus-width) + var(--focus-gap)));
}

.mobile-menu-dialog::backdrop {
  background-color: var(--color-deep);
}

.mobile-menu-dialog nav a {
  font-size: clamp(34px, 8vw, 56px);
  line-height: 1;
}

/*
 * Every link in the panel except the call to action, which brings its own
 * colour with its fill. The exclusion names `.nav-cta` rather than matching a
 * utility in the class attribute, so it moves with that class.
 */
.mobile-menu-dialog nav a[href]:not(.nav-cta) {
  color: var(--color-text);
}
</style>
