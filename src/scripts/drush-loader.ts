/*
 * On every page, so kept small: it watches for `drush ` typed outside a field
 * and shows Try a Command in the footer, then imports drush.ts. Both are built
 * with `?worker&url` (Footer.astro): a main-bundle import() would pull in
 * Vite's 1.7 KB preload helper, and a script element's src is blocked by the
 * site's Trusted Types CSP.
 */
const src = document.querySelector<HTMLScriptElement>('script[data-drush-app]')!
  .dataset.drushApp!;

const flags = document.documentElement.dataset;
const PREFIX = 'drush ';
const TYPED_MAX = 24;
let typed = '';

const wake = (): void => {
  if (flags.drushLoaded !== undefined) {
    document.dispatchEvent(new Event('drush'));
    return;
  }
  flags.drushLoaded = '';
  void import(/* @vite-ignore */ src);
};

document.addEventListener('keydown', (event) => {
  if (
    event.key.length > 1 ||
    (event.target as Element).closest(
      'input,textarea,select,[contenteditable],dialog',
    )
  )
    return;
  typed = (typed + event.key.toLowerCase()).slice(-TYPED_MAX);
  flags.drushTyped = typed;
  if (typed.includes(PREFIX)) wake();
});

/* In Footer.astro, hidden until now: without this script it would do nothing. */
const trigger = document.querySelector<HTMLButtonElement>('.drush-trigger')!;
trigger.hidden = false;
trigger.onclick = () => {
  flags.drushOpen = '';
  wake();
};

export {};
