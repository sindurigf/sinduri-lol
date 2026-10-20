/*
 * On every page, so kept small: shows Play With the Stickers in the footer
 * and loads toy.ts on its first press. `?worker&url` builds toy.ts as its own
 * file, loaded by a plain script tag: no preload helper in this chunk.
 */
import src from './toy.ts?worker&url';

const button = document.querySelector<HTMLButtonElement>('[data-toy-toggle]');
if (button) {
  button.hidden = false;
  button.addEventListener(
    'click',
    () => {
      document.head.append(
        Object.assign(document.createElement('script'), { src }),
      );
    },
    { once: true },
  );
}
