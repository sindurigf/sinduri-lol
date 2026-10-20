/* Contract and rejected alternatives: ARCHITECTURE.md "Scripts loaded on demand". */
const FEATURE_ATTRIBUTE = 'data-feature-';
const KEYS_STORAGE_KEY = 'on-demand-keys';
const KEYS_OFF = 'off';
const KEY_BUFFER_LENGTH = 16;
const TYPING_TARGETS = 'input, textarea, select';

const registry = document.querySelector('script[data-on-demand-registry]')!;
const urls = new Map<string, string>();
for (const { name, value } of registry.attributes) {
  if (name.startsWith(FEATURE_ATTRIBUTE)) {
    urls.set(name.slice(FEATURE_ATTRIBUTE.length), value);
  }
}

const triggers = [
  ...document.querySelectorAll<HTMLElement>('[data-on-demand]'),
].filter((trigger) => urls.has(trigger.dataset.onDemand!));
for (const trigger of triggers) trigger.hidden = false;

const loads = new Map<string, Promise<boolean>>();

const run = (trigger: HTMLElement): void => {
  const name = trigger.dataset.onDemand!;
  const url = urls.get(name);
  if (!url) return;
  let load = loads.get(name);
  if (!load) {
    load = import(url).then(
      () => true,
      (error: unknown) => {
        loads.delete(name);
        reportError(error);
        return false;
      },
    );
    loads.set(name, load);
  }
  void load.then((loaded) => {
    if (loaded) {
      document.dispatchEvent(
        new CustomEvent(`on-demand:${name}`, { detail: trigger }),
      );
    }
  });
};

document.addEventListener('click', (event) => {
  const trigger = (event.target as Element).closest<HTMLElement>(
    '[data-on-demand]',
  );
  if (trigger) run(trigger);
});

/* SC 2.1.4: a stored "off" turns character-key shortcuts off. */
const keysOn = (): boolean => {
  try {
    return localStorage.getItem(KEYS_STORAGE_KEY) !== KEYS_OFF;
  } catch {
    /* Storage is blocked, so no "off" can have been stored. */
    return true;
  }
};

const keyed = triggers.filter((trigger) => trigger.dataset.onDemandKeys);
let typed = '';
if (keyed.length > 0) {
  document.addEventListener('keydown', (event) => {
    const target = event.target as HTMLElement;
    if (
      event.ctrlKey ||
      event.altKey ||
      event.metaKey ||
      event.key.length !== 1 ||
      target.isContentEditable ||
      target.matches(TYPING_TARGETS)
    ) {
      return;
    }
    typed = (typed + event.key.toLowerCase()).slice(-KEY_BUFFER_LENGTH);
    const trigger = keyed.find((candidate) =>
      typed.endsWith(candidate.dataset.onDemandKeys!),
    );
    if (trigger && keysOn()) {
      typed = '';
      run(trigger);
    }
  });
}

export {};
