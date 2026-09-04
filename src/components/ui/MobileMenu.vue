<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';

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

const isOpen = ref(false);
const panel = ref<HTMLElement | null>(null);

const FOCUSABLE = 'a[href], button:not([disabled])';

const isActive = (href: string): boolean =>
  href === '/' ? props.currentPath === '/' : props.currentPath.startsWith(href);

const label = computed(() => (isOpen.value ? 'Close menu' : 'Open menu'));

const close = (): void => {
  isOpen.value = false;
};

const onKeydown = (event: KeyboardEvent): void => {
  if (event.key === 'Escape') {
    close();
    return;
  }

  if (event.key !== 'Tab' || !panel.value) return;

  const targets = Array.from(
    panel.value.querySelectorAll<HTMLElement>(FOCUSABLE),
  );
  const first = targets[0];
  const last = targets[targets.length - 1];
  if (!first || !last) return;

  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
};

watch(isOpen, (open) => {
  document.body.style.overflow = open ? 'hidden' : '';

  if (open) {
    window.addEventListener('keydown', onKeydown);
  } else {
    window.removeEventListener('keydown', onKeydown);
  }
});

onBeforeUnmount(() => {
  document.body.style.overflow = '';
  window.removeEventListener('keydown', onKeydown);
});
</script>

<template>
  <div class="md:hidden">
    <button
      type="button"
      class="flex h-12 w-12 items-center justify-center border-4 border-border bg-surface"
      :aria-expanded="isOpen"
      :aria-label="label"
      aria-controls="mobile-menu-panel"
      @click="isOpen = !isOpen"
    >
      <span class="sr-only">{{ label }}</span>
      <span aria-hidden="true" class="relative block h-4 w-6">
        <span
          class="absolute left-0 block h-[3px] w-6 bg-gold transition-transform duration-150"
          :class="isOpen ? 'top-[7px] rotate-45' : 'top-0'"
        />
        <span
          class="absolute left-0 top-[7px] block h-[3px] w-6 bg-gold transition-opacity duration-150"
          :class="isOpen ? 'opacity-0' : 'opacity-100'"
        />
        <span
          class="absolute left-0 block h-[3px] w-6 bg-gold transition-transform duration-150"
          :class="isOpen ? 'top-[7px] -rotate-45' : 'top-[14px]'"
        />
      </span>
    </button>

    <div
      v-show="isOpen"
      id="mobile-menu-panel"
      ref="panel"
      class="fixed inset-x-0 bottom-0 top-header z-40 overflow-y-auto bg-background px-6 py-10"
    >
      <nav aria-label="Mobile">
        <ul class="flex flex-col gap-8">
          <li v-for="link in links" :key="link.href">
            <a
              :href="link.href"
              :aria-current="isActive(link.href) ? 'page' : undefined"
              class="block font-black uppercase tracking-heading-tight text-text hover:text-cyan"
              style="font-size: clamp(34px, 8vw, 56px); line-height: 1"
              @click="close"
            >
              {{ link.label }}
            </a>
            <span
              v-if="isActive(link.href)"
              aria-hidden="true"
              class="mt-3 block h-2 w-2 bg-gold"
            />
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
    </div>
  </div>
</template>
