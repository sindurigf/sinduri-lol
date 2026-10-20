/*
 * On every page, so kept small: shows Play With the Stickers in the footer
 * and imports toy.ts on its first press. Both are built with `?worker&url`
 * (Footer.astro): a main-bundle import() would pull in Vite's 1.7 KB preload
 * helper, and a script element's src is blocked by the site's Trusted Types CSP.
 */
const src = document.querySelector<HTMLScriptElement>('script[data-toy-app]')!
  .dataset.toyApp!;
const button = document.querySelector<HTMLButtonElement>('[data-toy-toggle]');
if (button) {
  button.hidden = false;
  /* reportError: the failure reaches the console and window.onerror without a message string. */
  const load = (): void => {
    import(src).catch((error: unknown) => {
      button.addEventListener('click', load, { once: true });
      reportError(error);
    });
  };
  button.addEventListener('click', load, { once: true });
}

export {};
