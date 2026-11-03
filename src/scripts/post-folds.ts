/* Progressive: the folds are native <details> and work without it. Chromium opens them for find-in-page; other engines may not. */

/** Whether it opened a fold that was closed. */
const openFoldsAround = (target: Element | null): boolean => {
  let opened = false;
  for (
    let fold = target?.closest('details');
    fold;
    fold = fold.parentElement?.closest('details')
  ) {
    opened ||= !fold.open;
    fold.open = true;
  }
  return opened;
};

/* A malformed escape such as #50%-off throws URIError; the raw id is the best guess. */
const decodeId = (hash: string): string => {
  const id = hash.slice(1);
  try {
    return decodeURIComponent(id);
  } catch {
    return id;
  }
};

/* A module h2 sits just outside its fold; a link to it opens the module a reader closed. */
const openFor = (id: string): void => {
  const target = id ? document.getElementById(id) : null;
  /* The browser scrolled before the fold opened, to where the closed target was not shown. */
  if (openFoldsAround(target)) target?.scrollIntoView();
  const next = target?.nextElementSibling;
  if (next instanceof HTMLDetailsElement && next.matches('[data-module]'))
    next.open = true;
};

/* A link to an id inside a closed fold, where the browser does not open it itself. */
const openForHash = (): void => openFor(decodeId(location.hash));

openForHash();
addEventListener('hashchange', openForHash);

/* Same-page links, including one to the hash already in the address bar, which fires no hashchange. */
document.addEventListener('click', (event) => {
  if (!(event.target instanceof Element)) return;
  const link = event.target.closest<HTMLAnchorElement>('a[href^="#"]');
  if (link) openFor(decodeId(link.hash));
});

const controls = document.querySelector<HTMLElement>('.module-controls');
if (controls) {
  controls.hidden = false;
  controls.addEventListener('click', (event) => {
    if (!(event.target instanceof Element)) return;
    const action =
      event.target.closest<HTMLElement>('[data-modules]')?.dataset.modules;
    if (!action) return;
    for (const fold of document.querySelectorAll<HTMLDetailsElement>(
      'details[data-module]',
    )) {
      fold.open = action === 'open';
    }
  });
}

/* Print shows every fold, then puts the reader's choice back. */
let openedForPrint: HTMLDetailsElement[] = [];
addEventListener('beforeprint', () => {
  openedForPrint = [
    ...document.querySelectorAll<HTMLDetailsElement>(
      'details.post-fold:not([open])',
    ),
  ];
  for (const fold of openedForPrint) fold.open = true;
});
addEventListener('afterprint', () => {
  for (const fold of openedForPrint) fold.open = false;
  openedForPrint = [];
});
