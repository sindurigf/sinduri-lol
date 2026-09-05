<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue';

interface NavLink {
  href: string;
  label: string;
}

const props = defineProps<{
  links: NavLink[];
  ctaHref: string;
  ctaLabel: string;
  currentPath: string;
}>();

/*
 * Native <dialog> with showModal(). The browser supplies the whole feature set
 * that used to be hand-rolled here: it traps focus, moves focus into the
 * dialog on open, closes on Escape, restores focus to the trigger on close,
 * marks the rest of the page inert, and renders ::backdrop. No focus-trap
 * library, and no keydown handler of our own.
 */
const dialog = ref<HTMLDialogElement | null>(null);
const isOpen = ref(false);

const isActive = (href: string): boolean =>
  href === '/' ? props.currentPath === '/' : props.currentPath.startsWith(href);

// A modal dialog does not reliably stop the page behind it from scrolling.
const lockScroll = (locked: boolean): void => {
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

onBeforeUnmount(() => {
  lockScroll(false);
});
</script>

<template>
  <div class="md:hidden">
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
    >
      <!--
        Deliberately unnamed. The dialog around it is already named "Menu", and
        that is the context a screen reader announces on entry, so the nav needs
        nothing of its own. It used to carry aria-label="Primary", which
        duplicated the header nav's label: with the panel open both landmarks
        read "Primary, navigation" and neither could be told from the other in a
        landmarks list (landmark-unique, SC 1.3.1). Naming it something else
        would only invent a second name for the same set of links.

        The dialog is named with aria-label rather than a visually hidden
        heading, because an sr-only <h2> here would sit ahead of the page's <h1>
        in source order and corrupt the document outline.
      -->
      <nav>
        <ul class="flex flex-col gap-8">
          <!--
            The same active treatment as the desktop nav: a bordered box with
            the site's offset gold shadow, with the border present but
            transparent on every link so becoming current changes colour and
            shadow rather than geometry. Here that matters for a different
            reason than on desktop - these are stacked, so a border appearing
            on one item would shift every item below it.

            It replaces an 8x8 gold dot that sat after the link as a sibling.
            The dot was aria-hidden and `aria-current="page"` above is what
            actually announces the state, so nothing changes for a screen
            reader.
          -->
          <li v-for="link in links" :key="link.href">
            <a
              :href="link.href"
              :aria-current="isActive(link.href) ? 'page' : undefined"
              class="block border-4 px-4 py-2 font-black uppercase tracking-heading-tight"
              :class="
                isActive(link.href)
                  ? 'border-border text-text shadow-hard-gold-4'
                  : 'border-transparent text-text hover:text-cyan'
              "
              @click="close"
            >
              {{ link.label }}
            </a>
          </li>
        </ul>

        <a
          :href="ctaHref"
          class="mt-12 block rounded-nav border-4 border-border bg-cyan px-8 py-5 text-center text-label font-black uppercase tracking-label text-darkcyan"
          @click="close"
        >
          {{ ctaLabel }}
        </a>
      </nav>

      <button type="button" class="btn-secondary mt-12 w-full" @click="close">
        Close
      </button>
    </dialog>
  </div>
</template>

<style scoped>
/*
 * A <dialog> is display: none until opened and is centred in the top layer by
 * default, so it has to be reset to the full-bleed panel this design wants.
 * Sizing stays in the component because it is dialog mechanics, not a token.
 */
.mobile-menu-dialog {
  max-width: none;
  max-height: none;
  width: 100%;
  height: 100%;
  margin: 0;
  padding: 2.5rem 1.5rem;
  border: 0;
  background-color: var(--color-background);
  color: var(--color-text);
  overflow-y: auto;
}

.mobile-menu-dialog::backdrop {
  background-color: var(--color-deep);
}

.mobile-menu-dialog nav a {
  font-size: clamp(34px, 8vw, 56px);
  line-height: 1;
}

.mobile-menu-dialog nav a[href]:not([class*='bg-cyan']) {
  color: var(--color-text);
}
</style>
