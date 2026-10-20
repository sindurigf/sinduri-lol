/* Drink Me and Eat Me: step --text-scale. A group is "site" (remembered) or "page" (forgotten on navigation). */
import {
  TEXT_SCALE_DEFAULT,
  TEXT_SCALE_KEY,
  TEXT_SCALE_PROPERTY,
  TEXT_SCALE_STEPS,
} from '../lib/text-scale';

export {};

type Action = 'smaller' | 'larger' | 'reset';

const PERCENT = 100;
const last = TEXT_SCALE_STEPS.length - 1;

const run = (trigger: HTMLButtonElement): void => {
  const root = document.documentElement;
  const group = trigger.closest<HTMLElement>('[data-text-size]');
  const status = group?.querySelector<HTMLElement>('[data-size-status]');
  const action = trigger.dataset.sizeAction as Action | undefined;
  if (!group || !status || !action) {
    throw new Error('text-size: a button lacks its group, status or action.');
  }
  const now =
    parseFloat(root.style.getPropertyValue(TEXT_SCALE_PROPERTY)) * PERCENT ||
    TEXT_SCALE_DEFAULT;
  const at = Math.max(
    0,
    TEXT_SCALE_STEPS.findLastIndex((size) => size <= now),
  );
  const index =
    action === 'reset'
      ? TEXT_SCALE_STEPS.indexOf(TEXT_SCALE_DEFAULT)
      : Math.min(last, Math.max(0, at + (action === 'larger' ? 1 : -1)));
  const percent = TEXT_SCALE_STEPS[index]!;

  if (percent === TEXT_SCALE_DEFAULT)
    root.style.removeProperty(TEXT_SCALE_PROPERTY);
  else root.style.setProperty(TEXT_SCALE_PROPERTY, String(percent / PERCENT));

  for (const button of group.querySelectorAll<HTMLElement>(
    '[data-size-action]',
  )) {
    const kind = button.dataset.sizeAction as Action;
    const unavailable =
      kind === 'reset'
        ? percent === TEXT_SCALE_DEFAULT
        : index === (kind === 'smaller' ? 0 : last);
    button.setAttribute('aria-disabled', String(unavailable));
  }
  const stayed = index === at && action !== 'reset';
  status.textContent = stayed
    ? `Text is already the ${action === 'larger' ? 'largest' : 'smallest'} size, ${percent}%.`
    : `Text is ${percent}%.`;

  if (group.dataset.textSize !== 'site') return;
  try {
    if (percent === TEXT_SCALE_DEFAULT) localStorage.removeItem(TEXT_SCALE_KEY);
    else localStorage.setItem(TEXT_SCALE_KEY, String(percent));
  } catch {}
};

document.addEventListener('on-demand:text-size', (event) =>
  run((event as CustomEvent<HTMLButtonElement>).detail),
);
