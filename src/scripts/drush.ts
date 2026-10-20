/*
 * A Drush easter egg: typing a command anywhere outside a field runs it, and
 * Try a Command in the footer offers the same commands in a dialog. Every
 * command is a sequence of keys, never one key (SC 2.1.4). Loaded on intent
 * by drush-loader.ts.
 */
const REDUCED_MOTION = matchMedia('(prefers-reduced-motion: reduce)');
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

/* Built node by node: the site's CSP (Trusted Types) blocks HTML strings. */
const el = <K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Partial<HTMLElementTagNameMap[K]> & Record<string, unknown> = {},
  ...children: (Node | string)[]
): HTMLElementTagNameMap[K] => {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...children);
  return node;
};

const input = el('input', {
  id: 'drush-input',
  className: 'field-control',
  name: 'command',
  autocomplete: 'off',
  spellcheck: false,
  value: 'drush ',
});
const output = el('output', { className: 'drush-output' });
output.htmlFor.add('drush-input');
output.setAttribute('role', 'status');
const suggestions = el('ul', { className: 'drush-suggestions' });
suggestions.setAttribute('role', 'list');
const form = el(
  'form',
  { className: 'drush-form', method: 'dialog' },
  el(
    'label',
    { className: 'field-label mt-4 block', htmlFor: 'drush-input' },
    'Command',
  ),
  input,
  el(
    'button',
    { type: 'submit', className: 'btn-secondary cat-close mt-4' },
    'Run',
  ),
);
const closeButton = el(
  'button',
  { type: 'button', className: 'btn-secondary cat-close mt-4' },
  'Close',
);
const dialog = el(
  'dialog',
  { className: 'cat-dialog drush-dialog' },
  el(
    'div',
    { className: 'cat-card' },
    el('h2', { id: 'drush-title', className: 'text-h3 font-black' }, 'Drush'),
    el('p', { className: 'mt-2 text-body' }, 'Type a command, or pick one.'),
    form,
    suggestions,
    output,
    closeButton,
  ),
);
dialog.setAttribute('aria-labelledby', 'drush-title');
document.body.append(dialog);

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
  suggestions.append(item);
}

form.addEventListener('submit', (event) => {
  event.preventDefault();
  show(run(input.value));
});
closeButton.addEventListener('click', () => dialog.close());

const openDialog = (lines?: readonly string[]): void => {
  if (!dialog.open) dialog.showModal();
  if (lines) show(lines);
  input.focus();
};

/*
 * The loader (drush-loader.ts) keeps the typed keys in data-drush-typed and
 * asks for the dialog with data-drush-open, then fires `drush` once this runs.
 */
const flags = document.documentElement.dataset;
let handled = '';
const check = (): void => {
  if (flags.drushOpen !== undefined) {
    delete flags.drushOpen;
    openDialog();
  }
  const typed = flags.drushTyped ?? '';
  const command = Object.keys(OUTPUT).find((name) => typed.endsWith(name));
  if (!command || typed === handled) return;
  handled = typed;
  flags.drushTyped = '';
  if (command === 'drush cr') {
    run(command);
    /* Cleared first, so the same line is announced again on a second run. */
    announcer.textContent = '';
    requestAnimationFrame(() => {
      announcer.textContent = OUTPUT[command]![0]!;
    });
  } else {
    input.value = command;
    openDialog(run(command));
  }
};
document.addEventListener('drush', check);
check();

export {};
