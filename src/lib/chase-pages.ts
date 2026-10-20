/* Pure: the 404 rabbit's map. Each page carries its trail from Home, the way its breadcrumb would read. */
import { CAREER_PATH, CV_PATH } from './paths';
import type { SitePage } from './site-pages';

export interface ChasePage {
  readonly title: string;
  readonly path: string;
  /** Indexes into the same list, Home first and the page itself last. */
  readonly trail: readonly number[];
}

const HOME_PATH = '/';

/* The CV is a file at the root, but a reader finds it from Career. */
const ADOPTED: Readonly<Record<string, string>> = { [CV_PATH]: CAREER_PATH };

/* The nearest page above: the page a #fragment belongs to, else the longest path that contains this one. */
const parentOf = (path: string, paths: readonly string[]): string | null => {
  if (path === HOME_PATH) return null;
  const adopted = ADOPTED[path];
  if (adopted && paths.includes(adopted)) return adopted;
  const [base, fragment] = path.split('#');
  if (fragment !== undefined && base && paths.includes(base)) return base;
  const above = paths
    .filter(
      (other) =>
        !other.includes('#') &&
        other !== path &&
        other.endsWith('/') &&
        path.startsWith(other),
    )
    .sort((a, b) => b.length - a.length);
  return above[0] ?? HOME_PATH;
};

export const chasePages = (pages: readonly SitePage[]): ChasePage[] => {
  const paths = pages.map((page) => page.path);
  const indexOf = new Map(paths.map((path, index) => [path, index]));
  const trailOf = (path: string, seen: Set<string> = new Set()): number[] => {
    const index = indexOf.get(path);
    if (index === undefined || seen.has(path)) return [];
    seen.add(path);
    const parent = parentOf(path, paths);
    return [...(parent ? trailOf(parent, seen) : []), index];
  };
  return pages.map((page) => ({
    title: page.title,
    path: page.path,
    trail: trailOf(page.path),
  }));
};
