/*
 * The 404 page's White Rabbit: each press of Follow hops one step along the
 * breadcrumb to the page the mistyped address most likely meant, and lands
 * there with a link. Untimed (SC 2.2.1); the data comes from #chase-pages.
 */
import { rankPages } from '../lib/page-match';
import type { ChasePage } from '../lib/chase-pages';
import { ABOUT_PATH, BLOG_PATH, CAREER_PATH } from '../lib/paths';

/* Carroll's text, Project Gutenberg #11; the last one is said on arrival. */
const LINES = [
  'Oh dear! Oh dear! I shall be late!',
  'Oh my ears and whiskers, how late it’s getting!',
  'Oh! the Duchess, the Duchess! Oh! won’t she be savage if I’ve kept her waiting!',
  'The Duchess! The Duchess! Oh my dear paws! Oh my fur and whiskers!',
  'Quick, now!',
] as const;
const ARRIVAL = 'Where can I have dropped them, I wonder?';

/* With no match the rabbit tours the main rooms instead. */
const TOP_PATHS = ['/', ABOUT_PATH, BLOG_PATH, CAREER_PATH] as const;

const start = (): void => {
  const section = document.getElementById('rabbit-chase');
  const data = document.getElementById('chase-pages');
  if (!section || !data) return;
  const pages = JSON.parse(data.textContent ?? '[]') as ChasePage[];
  const line = section.querySelector<HTMLElement>('[data-line]');
  const trail = section.querySelector<HTMLOListElement>('[data-trail]');
  const runner = section.querySelector<HTMLElement>('[data-runner]');
  const follow = section.querySelector<HTMLButtonElement>('[data-follow]');
  const result = section.querySelector<HTMLElement>('[data-result]');
  const status = section.querySelector<HTMLElement>('[data-status]');
  if (!line || !trail || !runner || !follow || !result || !status) return;

  const best = rankPages(pages, location.pathname)[0];
  const route: ChasePage[] = best
    ? best.trail.map((index) => pages[index]!).filter(Boolean)
    : TOP_PATHS.map((path) => pages.find((page) => page.path === path)).filter(
        (page): page is ChasePage => page !== undefined,
      );
  if (route.length === 0) return;

  let hops = 0;
  line.textContent = LINES[0];
  section.hidden = false;

  follow.addEventListener('click', () => {
    const page = route[hops]!;
    hops += 1;
    /* The same crumb as src/components/Breadcrumbs.astro: an aria-hidden "/" kept with its link. */
    const stop = document.createElement('li');
    stop.className = 'rabbit-stop';
    const separator = document.createElement('span');
    separator.setAttribute('aria-hidden', 'true');
    separator.textContent = '/';
    const link = document.createElement('a');
    link.href = page.path;
    link.className = 'link hit-target inline-block';
    link.textContent = page.title;
    stop.append(separator, link, runner);
    trail.append(stop);

    if (hops < route.length) {
      line.textContent = LINES[hops % LINES.length]!;
      status.textContent = `The rabbit hops to ${page.title}.`;
      return;
    }

    line.textContent = ARRIVAL;
    link.setAttribute('aria-current', 'location');
    follow.hidden = true;
    const go = document.createElement('a');
    go.href = page.path;
    go.className = 'btn-secondary';
    go.textContent = best ? `Go to ${page.title}` : 'Go to the Homepage';
    if (!best) go.href = '/';
    result.replaceChildren(go);
    result.hidden = false;
    status.textContent = best
      ? `The rabbit stops at ${page.title}.`
      : 'The rabbit found no burrow at this address and stops at the main pages.';
    go.focus();
  });
};

start();
