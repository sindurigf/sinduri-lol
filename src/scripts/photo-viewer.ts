/*
 * Opens a PhotoTile's link in the photo viewer, PhotoViewer.astro, instead of
 * navigating to the file, and scrolls photo strips from their arrow buttons.
 *
 * Progressive: every photo is a plain link to its full-size file, and the
 * strip scrolls by itself with a mouse, a finger or the keyboard. This only
 * adds the viewer and the two buttons, which stay hidden without it.
 */

/** How far one press of a strip's arrow scrolls, as a share of its width. */
const STRIP_STEP = 0.8;

const reducedMotion = (): boolean =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** A click the page may take over: plain, primary button, nothing modified. */
const isPlainClick = (event: MouseEvent): boolean =>
  !event.defaultPrevented &&
  event.button === 0 &&
  !event.metaKey &&
  !event.ctrlKey &&
  !event.shiftKey &&
  !event.altKey;

const groupsOf = (root: ParentNode): Map<string, HTMLAnchorElement[]> => {
  const groups = new Map<string, HTMLAnchorElement[]>();
  for (const link of root.querySelectorAll<HTMLAnchorElement>(
    'a[data-photo]',
  )) {
    const name = link.dataset.photo ?? '';
    groups.set(name, [...(groups.get(name) ?? []), link]);
  }
  return groups;
};

const setUpViewer = (viewer: HTMLDialogElement): void => {
  const figure = viewer.querySelector<HTMLElement>('[data-viewer-figure]');
  const caption = viewer.querySelector<HTMLElement>('[data-viewer-caption]');
  const count = viewer.querySelector<HTMLElement>('[data-viewer-count]');
  const steps = viewer.querySelector<HTMLElement>('[data-viewer-steps]');
  const close = viewer.querySelector<HTMLButtonElement>('[data-viewer-close]');
  if (!figure || !caption || !count || !steps || !close) {
    throw new Error('photo-viewer: the dialog is missing one of its parts.');
  }

  const image = document.createElement('img');
  image.alt = '';
  let links: HTMLAnchorElement[] = [];
  let index = 0;

  const show = (next: number): void => {
    index = (next + links.length) % links.length;
    const link = links[index];
    const alt = link.querySelector('img')?.alt ?? '';
    image.src = link.href;
    image.alt = alt;
    caption.textContent = alt;
    count.textContent = `${index + 1} of ${links.length}`;
  };

  const open = (group: HTMLAnchorElement[], link: HTMLAnchorElement): void => {
    links = group;
    if (!image.isConnected) figure.append(image);
    steps.hidden = group.length < 2;
    show(group.indexOf(link));
    viewer.showModal();
  };

  for (const group of groupsOf(document).values()) {
    for (const link of group) {
      link.addEventListener('click', (event) => {
        if (!isPlainClick(event)) return;
        event.preventDefault();
        open(group, link);
      });
    }
  }

  for (const button of viewer.querySelectorAll<HTMLButtonElement>(
    '[data-viewer-step]',
  )) {
    const step = Number(button.dataset.viewerStep);
    button.addEventListener('click', () => show(index + step));
  }

  viewer.addEventListener('keydown', (event) => {
    if (links.length < 2) return;
    if (event.key === 'ArrowRight') show(index + 1);
    if (event.key === 'ArrowLeft') show(index - 1);
  });

  close.addEventListener('click', () => viewer.close());
};

const setUpStrips = (): void => {
  for (const button of document.querySelectorAll<HTMLButtonElement>(
    '[data-strip-scroll]',
  )) {
    const strip = document.getElementById(
      button.getAttribute('aria-controls') ?? '',
    );
    if (!strip) continue;
    const direction = Number(button.dataset.stripScroll);
    button.hidden = false;
    button.addEventListener('click', () => {
      strip.scrollBy({
        left: direction * strip.clientWidth * STRIP_STEP,
        behavior: reducedMotion() ? 'auto' : 'smooth',
      });
    });
  }
};

const viewer = document.querySelector<HTMLDialogElement>('#photo-viewer');
if (viewer) setUpViewer(viewer);
setUpStrips();
