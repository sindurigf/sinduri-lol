/* A Copy button beside every element marked data-copy; one delegated listener does the copying. */

export {};

const COPIED_VISIBLE_MS = 2000;
const SVG_NS = 'http://www.w3.org/2000/svg';
const ICON_PATH = 'M8 3h12v14h-2V5H8zM4 7h12v14H4z';

const announcer = document.createElement('div');
announcer.className = 'sr-only';
announcer.setAttribute('role', 'status');
document.body.append(announcer);

for (const source of document.querySelectorAll<HTMLElement>('[data-copy]')) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'copy-button';
  const icon = document.createElementNS(SVG_NS, 'svg');
  icon.setAttribute('viewBox', '0 0 24 24');
  icon.setAttribute('aria-hidden', 'true');
  icon.setAttribute('focusable', 'false');
  const path = document.createElementNS(SVG_NS, 'path');
  path.setAttribute('d', ICON_PATH);
  path.setAttribute('fill', 'currentColor');
  icon.append(path);
  const word = document.createElement('span');
  word.setAttribute('aria-hidden', 'true');
  word.textContent = 'Copy';
  const name = document.createElement('span');
  name.className = 'sr-only';
  name.textContent = `Copy ${source.dataset.copy}`;
  button.append(icon, word, name);
  source.previousElementSibling?.append(button);
}

document.addEventListener('click', async (event) => {
  const button = (event.target as Element).closest<HTMLButtonElement>(
    '.copy-button',
  );
  const source = button?.parentElement?.nextElementSibling;
  const word = button?.querySelector('span');
  if (!button || !source || !word) return;
  announcer.textContent = '';
  try {
    await navigator.clipboard.writeText(source.textContent ?? '');
    announcer.textContent = 'Copied';
    word.textContent = 'Copied';
    setTimeout(() => (word.textContent = 'Copy'), COPIED_VISIBLE_MS);
  } catch {
    getSelection()?.selectAllChildren(source);
    announcer.textContent =
      'Copy failed. The code is selected: press Ctrl+C or Command+C.';
  }
});
