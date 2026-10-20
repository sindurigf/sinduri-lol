/*
 * The 404 game: the missing page hides behind one of a row of bricks. Each
 * look is a turn, so it plays the same by keyboard, screen reader or pointer,
 * and under reduced motion only the lift is dropped. The rabbit is the footer's.
 */
const game = document.querySelector<HTMLElement>('[data-lost-game]');
const row = game?.querySelector<HTMLElement>('.lost-bricks');
const statusLine = game?.querySelector<HTMLElement>('.lost-status');
const again = game?.querySelector<HTMLButtonElement>('[data-lost-again]');
const rabbitArt = document.querySelector<SVGSVGElement>(
  'footer .footer-tuft > svg',
);

/* Placeholder copy: Sinduri rewrites every line below in her voice. */
const COPY = {
  start:
    'The rabbit hid this page behind one of these bricks. Can you find it?',
  warm: (n: number) =>
    `Not behind brick ${n}. Warm: it is right next to this one.`,
  cold: (n: number) => `Not behind brick ${n}. Cold: try further along.`,
  found: (n: number, turns: number) =>
    `Found it behind brick ${n} in ${turns} ${turns === 1 ? 'look' : 'looks'}! It was a typo all along.`,
  brick: (n: number) => `Look behind brick ${n}`,
  empty: (n: number) => `Brick ${n}, nothing here`,
};

const say = (text: string): void => {
  if (statusLine) statusLine.textContent = text;
};

/* The footer's rabbit drawing, in a footer-tuft svg so its styles apply. */
const rabbit = (): SVGSVGElement | null => {
  if (!rabbitArt) return null;
  const art = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  art.setAttribute('class', 'footer-tuft lost-rabbit');
  art.setAttribute('viewBox', rabbitArt.getAttribute('viewBox') ?? '');
  art.setAttribute('aria-hidden', 'true');
  art.append(...[...rabbitArt.childNodes].map((node) => node.cloneNode(true)));
  return art;
};

/* The bricks are in the page's markup; a deal resets them and hides the page again. */
const bricks = [...(row?.querySelectorAll<HTMLButtonElement>('button') ?? [])];
let hidden = 0;
let turns = 0;
let over = false;

const deal = (): void => {
  hidden = Math.floor(Math.random() * bricks.length) + 1;
  turns = 0;
  over = false;
  bricks.forEach((brick, index) => {
    const n = index + 1;
    brick.replaceChildren(String(n));
    brick.setAttribute('aria-label', COPY.brick(n));
    brick.removeAttribute('aria-disabled');
    delete brick.dataset.looked;
    delete brick.dataset.found;
  });
  say(COPY.start);
  again?.setAttribute('hidden', '');
};

bricks.forEach((brick, index) => {
  const n = index + 1;
  brick.addEventListener('click', () => {
    if (over || brick.getAttribute('aria-disabled') === 'true') return;
    turns += 1;
    brick.setAttribute('aria-disabled', 'true');
    brick.dataset.looked = '';
    if (n === hidden) {
      over = true;
      brick.dataset.found = '';
      brick.setAttribute('aria-label', COPY.found(n, turns));
      const art = rabbit();
      if (art) brick.replaceChildren(art);
      say(COPY.found(n, turns));
      again?.removeAttribute('hidden');
      return;
    }
    brick.setAttribute('aria-label', COPY.empty(n));
    say(Math.abs(n - hidden) === 1 ? COPY.warm(n) : COPY.cold(n));
  });
});

if (game) {
  again?.addEventListener('click', () => {
    deal();
    bricks[0]?.focus();
  });
  deal();
  game.hidden = false;
}
