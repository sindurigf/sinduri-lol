/* After a theme pick the moon stays turned into a grin until its CSS animation ends. */
const calm = matchMedia('(prefers-reduced-motion: reduce)');

document.addEventListener('change', (event) => {
  const menu = (event.target as Element).closest('.theme-menu');
  const button = menu && document.querySelector(`[popovertarget="${menu.id}"]`);
  if (!button || calm.matches) return;
  button.classList.add('grin');
  button.addEventListener(
    'animationend',
    () => button.classList.remove('grin'),
    {
      once: true,
    },
  );
});

export {};
