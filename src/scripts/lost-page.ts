/*
 * The 404 page's rabbit sniffs out the page the address meant: each press of
 * Sniff Around adds the next closest real page, best first, above the quick
 * links. Nothing is timed; each find is announced. The rabbit is the footer's.
 */
import { rankPages, type MatchablePage } from '../lib/page-match';

const FINDS = 3;

/* Placeholder copy: Sinduri rewrites every line below in her voice. */
const COPY = {
  found: (title: string) => `Found a trail: ${title}.`,
  more: 'Sniff Around Again',
  done: 'That is every trail the rabbit could find. The quick links are below them.',
  none: 'No trail here. Try one of the quick links.',
};

const game = document.querySelector<HTMLElement>('[data-lost-game]');
const sniff = game?.querySelector<HTMLButtonElement>('[data-lost-sniff]');
const finds = game?.querySelector<HTMLElement>('[data-lost-finds]');
const statusLine = game?.querySelector<HTMLElement>('.lost-status');
const spot = game?.querySelector<HTMLElement>('[data-lost-rabbit]');
const data = document.getElementById('lost-pages')?.textContent;
const rabbitArt = document.querySelector<SVGSVGElement>(
  'footer .footer-tuft > svg',
);

/* The footer's rabbit drawing, in a footer-tuft svg so its styles apply. */
const rabbit = (): SVGSVGElement | null => {
  if (!rabbitArt) return null;
  const art = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  art.setAttribute('class', 'footer-tuft lost-rabbit');
  art.setAttribute('viewBox', rabbitArt.getAttribute('viewBox') ?? '');
  art.append(...[...rabbitArt.childNodes].map((node) => node.cloneNode(true)));
  return art;
};

if (game && sniff && finds && statusLine && data) {
  const pages = JSON.parse(data) as MatchablePage[];
  const trail = rankPages(pages, location.pathname).slice(0, FINDS);
  const quick = finds.firstElementChild;
  let shown = 0;

  const art = rabbit();
  if (art && spot) spot.append(art);

  sniff.addEventListener('click', () => {
    const page = trail[shown];
    if (!page) {
      statusLine.textContent = shown ? COPY.done : COPY.none;
      sniff.hidden = true;
      return;
    }
    shown += 1;
    const item = document.createElement('li');
    item.dataset.found = '';
    const link = Object.assign(document.createElement('a'), {
      href: page.path,
      textContent: page.title,
    });
    item.append(link);
    finds.insertBefore(item, quick);
    statusLine.textContent = COPY.found(page.title);
    spot?.toggleAttribute('data-sniffing', true);
    spot?.addEventListener(
      'animationend',
      () => spot.removeAttribute('data-sniffing'),
      {
        once: true,
      },
    );
    if (shown === trail.length) {
      sniff.hidden = true;
      statusLine.textContent = `${COPY.found(page.title)} ${COPY.done}`;
    } else {
      sniff.textContent = COPY.more;
    }
  });
  sniff.hidden = false;
}
