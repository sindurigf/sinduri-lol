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

/* A link to an id inside a closed fold, where the browser does not open it itself. */
const openForHash = (): void => {
  const id = decodeURIComponent(location.hash.slice(1));
  if (id) openFoldsAround(document.getElementById(id));
};

openForHash();
addEventListener('hashchange', openForHash);

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
