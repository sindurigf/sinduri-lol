/* Narrows the wide sections list to the names that contain what is typed. */

const input = document.querySelector<HTMLInputElement>('[data-menu-filter]');
const status = document.querySelector<HTMLElement>('[data-menu-status]');
const list = document.querySelector<HTMLElement>('[data-menu-wide]');
if (!input || !status || !list) {
  throw new Error('brand-filter: the sections list lacks its filter parts.');
}

const filter = (): void => {
  const query = input.value.trim().toLowerCase();
  let shown = 0;
  for (const group of list.querySelectorAll<HTMLElement>(':scope > ol > li')) {
    let inGroup = 0;
    for (const item of group.querySelectorAll<HTMLElement>('ol > li')) {
      const match = (item.textContent ?? '').toLowerCase().includes(query);
      item.hidden = !match;
      if (match) inGroup += 1;
    }
    group.hidden = inGroup === 0;
    shown += inGroup;
  }
  status.textContent = `${shown} ${shown === 1 ? 'section' : 'sections'}`;
};

input.addEventListener('input', filter);
