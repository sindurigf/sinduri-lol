/*
 * The 404 page's Cheshire crossroads: from Home, each fork offers the pages one
 * level down as signs; the reader picks a way, can climb back, and ends on a real
 * page. The sign toward the page the address most likely meant is marked as the
 * White Rabbit's way. Untimed (SC 2.2.1); the data comes from #chase-pages.
 */
import { rankPages } from '../lib/page-match';
import type { ChasePage } from '../lib/chase-pages';

/* Carroll's text, Project Gutenberg #11, chapter VI; the last line is said at a dead end. */
const CAT_LINES = [
  '“Would you tell me, please, which way I ought to go from here?”',
  '“That depends a good deal on where you want to get to,” said the Cat.',
  '“Then it doesn’t matter which way you go,” said the Cat.',
  '“Oh, you’re sure to do that,” said the Cat, “if you only walk long enough.”',
] as const;
const DEAD_END =
  '“Oh, you can’t help that,” said the Cat: “we’re all mad here.”';

/* Degrees the watch hand turns per hop: decoration, never a timer. */
const HAND_STEP = 60;

const make = <K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};

const start = (): void => {
  const root = document.getElementById('crossroads');
  const data = document.getElementById('chase-pages');
  const runner = root?.querySelector<HTMLImageElement>('[data-runner]');
  if (!root || !data || !runner) return;
  const pages = JSON.parse(data.textContent ?? '[]') as ChasePage[];
  const home = pages.find((page) => page.trail.length === 1);
  if (!home) return;

  const childrenOf = (page: ChasePage): ChasePage[] => {
    const index = pages.indexOf(page);
    return pages.filter(
      (other) =>
        other.trail.length === page.trail.length + 1 &&
        other.trail.at(-2) === index,
    );
  };
  const best = rankPages(
    pages.filter((page) => page !== home),
    location.pathname,
  )[0];
  const rabbitWay = new Set(best?.trail ?? []);

  const watch = make('div', 'crossroads-watch label');
  const face = make('span', 'crossroads-watch-face');
  face.setAttribute('aria-hidden', 'true');
  const hops = make('span');
  watch.append(face, hops);
  const cat = make('div', 'crossroads-cat');
  const trail = make('nav', 'crossroads-trail');
  trail.setAttribute('aria-label', 'Breadcrumb');
  const crumbs = make('ol', 'label');
  crumbs.setAttribute('role', 'list');
  trail.append(crumbs);
  const signs = make('ul', 'crossroads-signs');
  signs.setAttribute('role', 'list');
  const stops = make('div', 'actions');
  const status = make('p', 'sr-only');
  status.setAttribute('aria-live', 'polite');

  const path: ChasePage[] = [home];

  const draw = (): void => {
    const here = path.at(-1)!;
    const next = childrenOf(here);
    const steps = path.length - 1;
    hops.textContent = `${steps} ${steps === 1 ? 'hop' : 'hops'}`;
    face.style.setProperty('--hand', `${steps * HAND_STEP}deg`);
    cat.textContent = next.length
      ? CAT_LINES[steps % CAT_LINES.length]!
      : DEAD_END;

    crumbs.replaceChildren(
      ...path.map((page, index) => {
        const item = make('li', 'crossroads-crumb');
        if (index > 0) {
          const separator = make('span', undefined, '/');
          separator.setAttribute('aria-hidden', 'true');
          item.append(separator);
        }
        const link = make('a', 'link hit-target inline-block', page.title);
        link.href = page.path;
        if (index === path.length - 1) {
          link.setAttribute('aria-current', 'location');
          item.append(link, runner);
        } else {
          item.append(link);
        }
        return item;
      }),
    );
    runner.hidden = false;

    signs.replaceChildren(
      ...next.map((page) => {
        const item = make('li');
        const sign = make('button', 'crossroads-sign label', page.title);
        sign.type = 'button';
        if (rabbitWay.has(pages.indexOf(page))) {
          sign.classList.add('crossroads-sign-rabbit');
          sign.append(
            make('span', 'sr-only', ' (the White Rabbit went this way)'),
          );
        }
        sign.addEventListener('click', () => {
          path.push(page);
          draw();
          status.textContent = childrenOf(page).length
            ? `${page.title}. Which way from here?`
            : `${page.title}. The end of this way.`;
          (signs.querySelector('button') ?? stops.querySelector('a'))?.focus();
        });
        item.append(sign);
        return item;
      }),
    );
    signs.hidden = next.length === 0;

    const actions: HTMLElement[] = [];
    if (here !== home || next.length === 0) {
      const go = make(
        'a',
        next.length ? 'btn-secondary' : 'btn-primary',
        `Go to ${here.title}`,
      );
      go.href = here.path;
      actions.push(go);
    }
    if (path.length > 1) {
      const back = make('button', 'btn-secondary', 'Climb Back Up');
      back.type = 'button';
      back.addEventListener('click', () => {
        path.pop();
        draw();
        status.textContent = `Back at ${path.at(-1)!.title}.`;
        signs.querySelector('button')?.focus();
      });
      actions.push(back);
    }
    stops.replaceChildren(...actions);
  };

  root.querySelector('[data-fallback]')?.remove();
  root.prepend(watch, cat, trail, signs, stops, status);
  draw();
};

start();
