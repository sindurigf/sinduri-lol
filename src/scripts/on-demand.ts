/* Contract and rejected alternatives: ARCHITECTURE.md "Scripts loaded on demand". */
const KEY_BUFFER_LENGTH = 16;
const TYPING_TARGETS = 'input,textarea,select,[contenteditable]';

const triggers = document.querySelectorAll<HTMLElement>('[data-on-demand]');
const loads = new Map<string, Promise<unknown>>();
let typed = '';

/* SC 2.1.4: a stored "off" turns the typed words off. */
const keysOn = (): boolean => {
  try {
    return localStorage.getItem('on-demand-keys') !== 'off';
  } catch {
    return true;
  }
};

const run = (trigger: HTMLElement): void => {
  const url = trigger.dataset.onDemand!;
  let load = loads.get(url);
  if (!load) loads.set(url, (load = import(url)));
  load.then(
    () => trigger.dispatchEvent(new Event('on-demand')),
    (error: unknown) => {
      loads.delete(url);
      reportError(error);
    },
  );
};

for (const trigger of triggers) trigger.hidden = false;

addEventListener('click', (event) => {
  const trigger = (event.target as Element).closest<HTMLElement>(
    '[data-on-demand]',
  );
  if (trigger) run(trigger);
});

addEventListener('keydown', (event) => {
  if (
    event.ctrlKey ||
    event.altKey ||
    event.metaKey ||
    (event.target as Element).closest(TYPING_TARGETS)
  ) {
    return;
  }
  typed = (typed + event.key).slice(-KEY_BUFFER_LENGTH);
  for (const trigger of triggers) {
    const word = trigger.dataset.onDemandKeys;
    if (word && typed.endsWith(word) && keysOn()) {
      typed = '';
      run(trigger);
    }
  }
});

export {};
