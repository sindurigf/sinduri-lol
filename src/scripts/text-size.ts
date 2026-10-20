/* Drink Me and Eat Me: step the root font size. A group is "site" (remembered) or "page" (forgotten on navigation). */
import {
  TEXT_SCALE_DEFAULT,
  TEXT_SCALE_KEY,
  TEXT_SCALE_STEPS,
} from '../lib/text-scale';

type Action = 'smaller' | 'larger' | 'reset';

const root = document.documentElement;
const current = (): number =>
  parseFloat(root.style.fontSize) || TEXT_SCALE_DEFAULT;

/** Runs on each press of one of a group's buttons. */
export default (trigger: HTMLButtonElement): void => {
  const group = trigger.closest<HTMLElement>('[data-text-size]');
  const status = group?.querySelector<HTMLElement>('[data-size-status]');
  const action = trigger.dataset.sizeAction as Action | undefined;
  if (!group || !status || !action) {
    throw new Error('text-size: a button lacks its group, status or action.');
  }
  const last = TEXT_SCALE_STEPS.length - 1;
  const start = TEXT_SCALE_STEPS.findIndex((size) => size >= current());
  const index =
    action === 'reset'
      ? TEXT_SCALE_STEPS.indexOf(TEXT_SCALE_DEFAULT)
      : Math.min(last, Math.max(0, start + (action === 'larger' ? 1 : -1)));
  const percent = TEXT_SCALE_STEPS[index]!;

  root.style.fontSize = percent === TEXT_SCALE_DEFAULT ? '' : `${percent}%`;
  for (const button of group.querySelectorAll<HTMLElement>(
    '[data-size-action]',
  )) {
    const ends = { smaller: 0, larger: last } as const;
    const at = button.dataset.sizeAction as Action;
    button.setAttribute(
      'aria-disabled',
      String(
        at === 'reset' ? percent === TEXT_SCALE_DEFAULT : index === ends[at],
      ),
    );
  }
  status.textContent = `Text is ${percent}%.`;

  if (group.dataset.textSize !== 'site') return;
  try {
    if (percent === TEXT_SCALE_DEFAULT) localStorage.removeItem(TEXT_SCALE_KEY);
    else localStorage.setItem(TEXT_SCALE_KEY, String(percent));
  } catch {}
};
