/* A Copy button beside every element marked data-copy; one delegated listener does the copying. */

const COPIED_VISIBLE_MS = 2000;
const ICON_PATH = 'M8 3h12v14h-2V5H8zM4 7h12v14H4z';

const status = document.createElement('div');
status.className = 'sr-only';
status.setAttribute('role', 'status');
document.body.append(status);

for (const source of document.querySelectorAll<HTMLElement>('[data-copy]')) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'copy-button';
  button.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="${ICON_PATH}" fill="currentColor"></path></svg><span aria-hidden="true">Copy</span><span class="sr-only">Copy ${source.dataset.copy}</span>`;
  source.previousElementSibling?.append(button);
}

document.addEventListener('click', async (event) => {
  const button = (event.target as Element).closest<HTMLButtonElement>(
    '.copy-button',
  );
  const source = button?.parentElement?.nextElementSibling;
  const word = button?.querySelector('span');
  if (!button || !source || !word) return;
  try {
    await navigator.clipboard.writeText(source.textContent ?? '');
    status.textContent = 'Copied';
    word.textContent = 'Copied';
    setTimeout(() => (word.textContent = 'Copy'), COPIED_VISIBLE_MS);
  } catch {
    getSelection()?.selectAllChildren(source);
    status.textContent = 'Copy failed, the code is selected';
  }
});
