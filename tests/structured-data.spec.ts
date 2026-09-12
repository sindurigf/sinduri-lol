import { expect, test } from '@playwright/test';
import { builtHtml, ROUTES } from './routes';

/**
 * The JSON-LD graph in every page's head.
 *
 * Nothing on the page renders any of this, so both failures it can have are
 * invisible to a reader:
 *
 *   1. It says something the site no longer says. `PERSON_NAME` in
 *      src/lib/profiles.ts is a second copy of what the homepage <h1> renders
 *      as two coloured spans, so the two cannot be wired together. A rename
 *      touching only one would publish a name the site itself contradicts, so
 *      the assertion compares the two rather than either against a constant
 *      declared here.
 *
 *   2. It stops being valid JSON. `set:html` with `JSON.stringify` cannot
 *      really produce that, but a hand-edit to the template can, and an
 *      unparseable block is skipped in silence by every consumer.
 *
 * The HTML is matched raw. It carries no authored comments (tests/seo.spec.ts);
 * before that was enforced, a comment naming `<h1>` made the extracted name
 * six paragraphs of prose. It reads dist/ inside test bodies only; see
 * tests/routes.ts.
 *
 * Whether the browser refuses this block under the CSP is checked by
 * tests/headers.spec.ts, not here: a violation is a property of the policy and
 * belongs with the policy. See src/lib/structured-data.ts.
 *
 * Proven able to fail, 2026-09-09:
 *
 *   - PERSON_NAME renamed in src/lib/profiles.ts fails only "the published
 *     name is the name the homepage shows";
 *   - a URL added to `sameAs` that the page does not link fails only "sameAs
 *     lists every profile the footer links";
 *   - the Person inlined into WebSite.author instead of referenced by @id
 *     fails only "the author is a reference, not a second person";
 *   - the block removed from BaseLayout fails every test in this file.
 *
 * One more mutation is in tests/headers.spec.ts. Emitting this block required
 * teaching the CSP drift test to skip `application/ld+json`, so the exemption
 * was checked from the other side: a real `<script is:inline>` in the same
 * <head> fails three tests there. The exemption is one MIME type wide and the
 * policy is still enforced.
 */

const LD_JSON =
  /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/i;

type Node = Record<string, unknown>;

const graphOf = (rawHtml: string, route: string): Node[] => {
  const match = LD_JSON.exec(rawHtml);
  expect(
    match,
    `${route} carries no <script type="application/ld+json">. Every page ` +
      'gets one from BaseLayout; a route without it has stopped using the ' +
      'layout.',
  ).not.toBeNull();

  let parsed: { '@graph'?: Node[] };
  try {
    parsed = JSON.parse(match![1]!);
  } catch (error) {
    throw new Error(
      `${route} has JSON-LD that is not valid JSON, so every consumer skips ` +
        `it in silence: ${(error as Error).message}`,
    );
  }

  expect(
    Array.isArray(parsed['@graph']),
    `${route} has JSON-LD with no @graph array`,
  ).toBe(true);

  return parsed['@graph']!;
};

const nodeOfType = (graph: Node[], type: string): Node | undefined =>
  graph.find((node) => node['@type'] === type);

/** The homepage <h1>, flattened to the text a reader sees. */
const headingText = (rawHtml: string): string => {
  const h1 = /<h1\b[^>]*>([\s\S]*?)<\/h1>/i.exec(rawHtml);
  expect(
    h1,
    'the homepage has no <h1> to compare the name against',
  ).not.toBeNull();

  return h1![1]!
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

test.describe('JSON-LD structured data', () => {
  /*
   * One test over every route. These are string checks on built HTML, so there
   * is nothing per-route to isolate, and `expect.soft` names every failing
   * route in one run. The `checked` count is the floor: comparing two empty
   * lists passes, so without it an empty ROUTES would leave this green.
   */
  test('every route carries one valid graph', () => {
    const pages = builtHtml();
    const checked: string[] = [];

    for (const route of ROUTES) {
      const html = pages.get(route);
      expect(html, `${route} was not found in the build`).toBeTruthy();
      checked.push(route);

      const graph = graphOf(html!, route);

      expect
        .soft(
          nodeOfType(graph, 'Person'),
          `${route} has JSON-LD with no Person node`,
        )
        .toBeDefined();
      expect
        .soft(
          nodeOfType(graph, 'WebSite'),
          `${route} has JSON-LD with no WebSite node`,
        )
        .toBeDefined();
    }

    expect(
      checked,
      'the per-route walk visited a different set of routes than ROUTES. It ' +
        'passes vacuously if that list is ever empty.',
    ).toEqual([...ROUTES]);
  });

  test('the published name is the name the homepage shows', () => {
    const pages = builtHtml();
    const person = nodeOfType(graphOf(pages.get('/')!, '/'), 'Person')!;

    /*
     * The heading renders the name as two coloured spans, so it is markup
     * rather than a string PERSON_NAME could be imported into. Comparing them
     * stops a rename landing in one and not the other.
     */
    expect(
      person.name,
      'the JSON-LD Person and the homepage <h1> disagree about the name. ' +
        'PERSON_NAME in src/lib/profiles.ts is a second copy of what that ' +
        'heading renders; one of them was changed and the other was not.',
    ).toBe(headingText(pages.get('/')!));
  });

  test('sameAs lists every profile the footer links', () => {
    for (const [route, html] of builtHtml()) {
      const person = nodeOfType(graphOf(html, route), 'Person')!;
      const sameAs = (person.sameAs as string[]) ?? [];

      /*
       * The footer's profile links come from the same module `sameAs` does.
       * Scraping them back out of the rendered HTML rather than importing the
       * module is what makes this end to end: it fails if one of the two lists
       * is filtered somewhere along the way.
       */
      const footerProfiles = [
        ...html.matchAll(/href="(https:\/\/[^"]+)"/g),
      ].map((match) => match[1]!);

      for (const profile of sameAs) {
        expect(
          footerProfiles,
          `${route} publishes ${profile} in sameAs but links it nowhere on ` +
            'the page. sameAs is a claim that these accounts are the same ' +
            'person as this site, so it should not name one the site does ' +
            'not itself point at.',
        ).toContain(profile);
      }

      expect(
        sameAs.length,
        `${route} has an empty sameAs, which is the field that connects this ` +
          'site to the profiles a search engine already knows about.',
      ).toBeGreaterThan(0);
    }
  });

  test('the author is a reference, not a second person', () => {
    const html = builtHtml().get('/')!;
    const graph = graphOf(html, '/');
    const person = nodeOfType(graph, 'Person')!;
    const website = nodeOfType(graph, 'WebSite')!;

    /*
     * Inlining the Person into the WebSite would create a second entity that
     * only looks the same, which is the mistake `@id` exists to prevent: a
     * consumer merging the graph ends up with two people.
     */
    for (const field of ['author', 'publisher'] as const) {
      expect(
        website[field],
        `WebSite.${field} should reference the Person by @id rather than ` +
          'repeating it, or a consumer merging this graph gets two people ' +
          'where the site has one.',
      ).toEqual({ '@id': person['@id'] });
    }
  });
});
