/* Curiouser: a reel of real titles slows and lands on a page that is not this one; a link then goes there. */

const REEL_STEPS = 7;
const REEL_BASE_MS = 40;
const REEL_SLOWING_MS = 5;

type Page = readonly [title: string, href: string];

interface Scope {
  reel: HTMLElement;
  go: HTMLAnchorElement;
  landed: HTMLElement;
  last: string;
  busy: boolean;
}

const scopes = new WeakMap<Element, Scope>();

const pagesOf = (scope: HTMLElement): Page[] => {
  const data: unknown = JSON.parse(scope.dataset.pages ?? 'null');
  if (
    !Array.isArray(data) ||
    !data.every(
      (page) =>
        Array.isArray(page) &&
        typeof page[0] === 'string' &&
        typeof page[1] === 'string',
    )
  ) {
    throw new Error('curiouser: data-pages is not a list of [title, href].');
  }
  return data as Page[];
};

const setUp = (scope: Element, trigger: HTMLElement): Scope => {
  const result = scope.querySelector<HTMLElement>('[data-curiouser-result]');
  const landed = scope.querySelector<HTMLElement>('[data-curiouser-status]');
  if (!result || !landed) {
    throw new Error('curiouser: a scope lacks its result or status.');
  }
  const reel = document.createElement('span');
  reel.setAttribute('aria-hidden', 'true');
  const go = document.createElement('a');
  go.hidden = true;
  go.className = trigger.dataset.goClass ?? '';
  result.append(reel, go);
  return { reel, go, landed, last: '', busy: false };
};

export {};

const run = (trigger: HTMLButtonElement): void => {
  const scope = trigger.closest<HTMLElement>('[data-curiouser-scope]');
  if (!scope) throw new Error('curiouser: the button has no scope.');
  const state = scopes.get(scope) ?? setUp(scope, trigger);
  scopes.set(scope, state);
  if (state.busy) return;

  const pages = pagesOf(scope);
  const choices = pages.filter(
    ([, href]) => href !== location.pathname && href !== state.last,
  );
  const target = choices[Math.floor(Math.random() * choices.length)];
  if (!target) return;

  const land = (): void => {
    state.last = target[1];
    state.reel.textContent = '';
    state.go.href = target[1];
    state.go.textContent = `Go to ${target[0]}`;
    state.go.hidden = false;
    state.landed.textContent = `Landed on ${target[0]}.`;
    state.busy = false;
  };

  state.go.hidden = true;
  state.landed.textContent = '';
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
    land();
    return;
  }
  state.busy = true;
  let step = 0;
  const tick = (): void => {
    step += 1;
    if (step >= REEL_STEPS) {
      land();
      return;
    }
    state.reel.textContent =
      pages[Math.floor(Math.random() * pages.length)]![0];
    setTimeout(tick, REEL_BASE_MS + step * step * REEL_SLOWING_MS);
  };
  tick();
};

for (const trigger of document.querySelectorAll<HTMLButtonElement>(
  '[data-curiouser]',
)) {
  trigger.addEventListener('on-demand', () => run(trigger));
}
