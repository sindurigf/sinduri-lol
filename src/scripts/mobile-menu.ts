/*
 * The mobile menu in Header.astro: a native <dialog> opened with showModal().
 * The browser traps focus, moves focus into the dialog on open, closes on
 * Escape, restores focus to the trigger on close, marks the rest of the page
 * inert and renders ::backdrop. No focus-trap library, and no keydown handler
 * of our own.
 *
 * `data-menu-ready` goes on the wrapper once everything is wired, so a test can
 * wait for the one script every route runs; tests/settle.ts reads it.
 */

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
const keepInView = (panel: HTMLDialogElement, event: FocusEvent): void => {
  const control = event.target;
  if (!(control instanceof HTMLElement)) return;

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

const setUpMenu = (root: HTMLElement): void => {
  const trigger = root.querySelector<HTMLButtonElement>('[data-menu-trigger]');
  const panel = root.querySelector<HTMLDialogElement>('dialog');
  if (!trigger || !panel) {
    throw new Error('mobile-menu: the trigger or the dialog is missing.');
  }

  const open = (): void => {
    panel.showModal();
    trigger.setAttribute('aria-expanded', 'true');
    lockScroll(true);
  };

  // Always go through close() so the browser restores focus to the trigger.
  const close = (): void => panel.close();

  /*
   * The single source of truth for the closed state. Escape closes the dialog
   * without going through close(), so aria-expanded and the scroll lock are
   * reset here rather than in a click handler.
   */
  panel.addEventListener('close', () => {
    trigger.setAttribute('aria-expanded', 'false');
    lockScroll(false);
  });

  trigger.addEventListener('click', open);
  panel.addEventListener('focusin', (event) => keepInView(panel, event));
  for (const control of panel.querySelectorAll('a[href], [data-menu-close]')) {
    control.addEventListener('click', close);
  }

  root.dataset.menuReady = 'true';
};

const menu = document.querySelector<HTMLElement>('[data-mobile-menu]');
if (menu) setUpMenu(menu);
