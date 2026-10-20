/* Tickle the Rabbit: the footer rabbit giggles and the name band laughs. Motion lives in footer.css; this only restarts it. */
export {};

/* Placeholder copy: Sinduri rewrites it in her voice. */
const GIGGLES = 'The rabbit giggles.';

const button = document.querySelector<HTMLButtonElement>(
  '[data-rabbit-tickle]',
);
const rabbit = document.querySelector<HTMLElement>('.footer-rabbit');
const name = document.querySelector<HTMLElement>('.footer-name-text');
if (!button || !rabbit || !name) {
  throw new Error(
    'rabbit-tickle: the footer lacks its button, rabbit or name.',
  );
}

const status = Object.assign(document.createElement('p'), {
  className: 'sr-only',
});
status.setAttribute('role', 'status');
/* Outside the band, whose text is the name alone. */
button.closest('footer')!.append(status);

/* Removing and re-adding the attribute restarts a running animation on a quick second press. */
const replay = (el: HTMLElement): void => {
  el.removeAttribute('data-tickled');
  void el.offsetWidth;
  el.setAttribute('data-tickled', '');
};

button.addEventListener('on-demand', () => {
  replay(rabbit);
  replay(name);
  status.textContent = '';
  requestAnimationFrame(() => {
    status.textContent = GIGGLES;
  });
});
