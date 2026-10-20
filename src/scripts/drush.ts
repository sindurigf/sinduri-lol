/*
 * A Drush easter egg: typing a command anywhere outside a field runs it, and
 * Try a Command in the footer offers the same commands in a dialog. Every
 * command is a sequence of keys, never one key (SC 2.1.4).
 */
const REDUCED_MOTION = matchMedia('(prefers-reduced-motion: reduce)');
const TYPED_MAX = 24;
const SHUFFLE_MS = 900;
const SHUFFLE_DRIFT_PX = 24;
const SHUFFLE_TURN_DEG = 6;
const BRICKS = 'main :is(.card-block > *, .card:not(.card-block *))';

/* Placeholder copy: Sinduri rewrites every line below in her voice. */
const OUTPUT: Readonly<Record<string, readonly string[]>> = {
  'drush cr': ['Cache cleared. Kindness rebuilt.'],
  'drush en kindness': ['Kindness is already enabled. It stays on.'],
  'drush status': [
    'Drupal bootstrap: Successful',
    'Cats: 3, all asleep',
    'Kindness: Enabled',
    'Coffee: Low',
  ],
  'drush uli': ['Logged in as Friend. Welcome back!'],
};
const NOT_FOUND = 'Command not found. Try drush cr.';

const announcer = Object.assign(document.createElement('p'), {
  className: 'sr-only',
});
announcer.setAttribute('role', 'status');
document.body.append(announcer);

/* Each brick on screen jumps and lands back in place: transforms only, never in the reading order. */
const shuffle = (): void => {
  if (REDUCED_MOTION.matches) return;
  document.querySelectorAll<HTMLElement>(BRICKS).forEach((brick) => {
    const { top, bottom } = brick.getBoundingClientRect();
    if (bottom < 0 || top > innerHeight) return;
    const drift = () => (Math.random() - 0.5) * 2 * SHUFFLE_DRIFT_PX;
    brick.animate(
      [
        { translate: '0 0', rotate: '0deg' },
        {
          translate: `${drift()}px ${drift()}px`,
          rotate: `${(Math.random() - 0.5) * 2 * SHUFFLE_TURN_DEG}deg`,
        },
        { translate: '0 0', rotate: '0deg' },
      ],
      { duration: SHUFFLE_MS, easing: 'cubic-bezier(0.3, 1.4, 0.5, 1)' },
    );
  });
};

const run = (command: string): readonly string[] => {
  const typed = command.trim().toLowerCase().replace(/\s+/g, ' ');
  if (typed === 'drush cr') shuffle();
  return OUTPUT[typed] ?? [NOT_FOUND];
};

const dialog = document.createElement('dialog');
dialog.className = 'cat-dialog drush-dialog';
dialog.setAttribute('aria-labelledby', 'drush-title');
dialog.innerHTML = `<div class="cat-card">
  <h2 id="drush-title" class="text-h3 font-black">Drush</h2>
  <p class="mt-2 text-body">Type a command, or pick one.</p>
  <form class="drush-form" method="dialog">
    <label class="field-label mt-4 block" for="drush-input">Command</label>
    <input id="drush-input" class="field-control" name="command" autocomplete="off" spellcheck="false" value="drush ">
    <button type="submit" class="btn-secondary cat-close mt-4">Run</button>
  </form>
  <ul class="drush-suggestions" role="list"></ul>
  <output class="drush-output" for="drush-input" role="status"></output>
  <button type="button" class="btn-secondary cat-close mt-4" data-drush-close>Close</button>
</div>`;
document.body.append(dialog);

const input = dialog.querySelector<HTMLInputElement>('#drush-input')!;
const output = dialog.querySelector<HTMLOutputElement>('.drush-output')!;
const show = (lines: readonly string[]): void => {
  output.replaceChildren(
    ...lines.map((line) =>
      Object.assign(document.createElement('span'), { textContent: line }),
    ),
  );
};

for (const command of Object.keys(OUTPUT)) {
  const item = document.createElement('li');
  const pick = Object.assign(document.createElement('button'), {
    type: 'button',
    className: 'btn-secondary cat-close drush-chip',
    textContent: command,
  });
  pick.addEventListener('click', () => {
    input.value = command;
    show(run(command));
  });
  item.append(pick);
  dialog.querySelector('.drush-suggestions')!.append(item);
}

dialog.querySelector('form')!.addEventListener('submit', (event) => {
  event.preventDefault();
  show(run(input.value));
});
dialog
  .querySelector('[data-drush-close]')!
  .addEventListener('click', () => dialog.close());

const open = (lines?: readonly string[]): void => {
  if (!dialog.open) dialog.showModal();
  if (lines) show(lines);
  input.focus();
};

const trigger = Object.assign(document.createElement('button'), {
  type: 'button',
  className: 'drush-trigger label',
  textContent: 'Try a Command',
});
trigger.addEventListener('click', () => open());
document.querySelector('footer .footer-copyright')?.after(trigger);

const FIELD =
  'input, textarea, select, [contenteditable]:not([contenteditable="false"])';
let typed = '';
document.addEventListener('keydown', (event) => {
  if (event.ctrlKey || event.metaKey || event.altKey || event.key.length !== 1)
    return;
  if (
    event.target instanceof Element &&
    event.target.closest(`${FIELD}, dialog`)
  )
    return;
  typed = (typed + event.key.toLowerCase()).slice(-TYPED_MAX);
  const command = Object.keys(OUTPUT).find((name) => typed.endsWith(name));
  if (!command) return;
  typed = '';
  if (command === 'drush cr') {
    run(command);
    /* Cleared first, so the same line is announced again on a second run. */
    announcer.textContent = '';
    requestAnimationFrame(() => {
      announcer.textContent = OUTPUT[command]![0]!;
    });
  } else {
    input.value = command;
    open(run(command));
  }
});
