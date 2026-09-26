/*
 * Shows a failed photo's alt text in its frame, since WebKit draws none. The
 * copy is `aria-hidden` so it is announced once. Images can fail before this
 * runs, so they are also swept on arrival and on `load`.
 */

const IMAGES = '.aspect-frame > img, .aspect-frame > picture > img';
const ALT_CLASS = 'aspect-frame-alt';

/* Below this frame width the text takes the label size. */
const SMALL_FRAME_REM = 20;

const rootFontSize = (): number =>
  parseFloat(getComputedStyle(document.documentElement).fontSize);

const hasFailed = (img: HTMLImageElement): boolean =>
  img.complete && img.naturalWidth === 0 && img.getAttribute('src') !== null;

/* Whole lines only, with the top inset mirrored at the bottom. */
const fit = (frame: HTMLElement, text: HTMLElement): void => {
  text.dataset.size =
    frame.clientWidth < SMALL_FRAME_REM * rootFontSize() ? 'small' : 'normal';
  const lineHeight = parseFloat(getComputedStyle(text).lineHeight);
  const lines = Math.max(
    1,
    Math.floor((frame.clientHeight - 2 * text.offsetTop) / lineHeight),
  );
  text.style.setProperty('--alt-lines', String(lines));
};

const markFailed = (img: HTMLImageElement): void => {
  const frame = img.closest<HTMLElement>('.aspect-frame');
  if (frame === null || 'failed' in frame.dataset) return;
  frame.dataset.failed = '';

  const alt = img.alt.trim();
  if (alt === '') return;

  const text = document.createElement('span');
  text.className = ALT_CLASS;
  text.setAttribute('aria-hidden', 'true');
  text.textContent = alt;
  frame.append(text);

  fit(frame, text);
  new ResizeObserver(() => fit(frame, text)).observe(frame);
};

const sweep = (): void => {
  document.querySelectorAll<HTMLImageElement>(IMAGES).forEach((img) => {
    if (hasFailed(img)) markFailed(img);
  });
};

document.querySelectorAll<HTMLImageElement>(IMAGES).forEach((img) => {
  img.addEventListener('error', () => markFailed(img), { once: true });
});
sweep();
window.addEventListener('load', sweep, { once: true });
