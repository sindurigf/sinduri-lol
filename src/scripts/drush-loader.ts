/*
 * On every page, so kept small: it watches for `drush ` typed outside a field
 * and shows Try a Command in the footer, then loads drush.ts. `?worker&url`
 * builds drush.ts as its own file, loaded by a plain script tag: no preload
 * helper in this chunk.
 */
import src from './drush.ts?worker&url';

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
  document.head.append(
    Object.assign(document.createElement('script'), { src }),
  );
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
