/* Progressive: the folds are native <details> and work without it; find-in-page opens them natively. */

const openFoldsAround = (target: Element | null): void => {
  for (
    let fold = target?.closest('details');
    fold;
    fold = fold.parentElement?.closest('details')
  ) {
    fold.open = true;
  }
};

/* A module h2 sits just outside its fold; a link to it opens the module a reader closed. */
const openFor = (id: string): void => {
  const target = id ? document.getElementById(id) : null;
  openFoldsAround(target);
  const next = target?.nextElementSibling;
  if (next instanceof HTMLDetailsElement && next.matches('[data-module]'))
    next.open = true;
};

/* A link to an id inside a closed fold, where the browser does not open it itself. */
const openForHash = (): void =>
  openFor(decodeURIComponent(location.hash.slice(1)));

openForHash();
addEventListener('hashchange', openForHash);

/* Same-page links, including one to the hash already in the address bar, which fires no hashchange. */
document.addEventListener('click', (event) => {
  const link = (event.target as Element).closest<HTMLAnchorElement>(
    'a[href^="#"]',
  );
  if (link) openFor(decodeURIComponent(link.hash.slice(1)));
});

const controls = document.querySelector<HTMLElement>('.module-controls');
if (controls) {
  controls.hidden = false;
  controls.addEventListener('click', (event) => {
    const action = (event.target as Element).closest<HTMLElement>(
      '[data-modules]',
    )?.dataset.modules;
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
