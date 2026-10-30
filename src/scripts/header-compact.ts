/*
 * The slim header once the page scrolls past the full one. A state, not an
 * animation, so reduced motion needs nothing more. tests/header-fit.spec.ts.
 */
const header = document.querySelector('header.site-header');
const sentinel = document.querySelector('[data-header-sentinel]');

/* An observer, not a scroll listener: WebKit can miss a scroll made right after load (https://github.com/sindurigf/sinduri-lol/actions/runs/41066465472). */
if (header && sentinel) {
  new IntersectionObserver(([entry]) => {
    header.toggleAttribute('data-compact', !entry?.isIntersecting);
  }).observe(sentinel);
}
