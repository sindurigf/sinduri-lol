import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createSatteriMarkdownProcessor } from '@astrojs/markdown-satteri';
import ts from 'typescript';
import { expect, test, type Page } from './test';
import { gotoSettled } from './settle';
import { moduleFold, postFold } from '../src/plugins/post-fold.mjs';
import { linkListItem } from '../src/plugins/link-list-item.mjs';
import { postFigure } from '../src/plugins/post-figure.mjs';
import { codeBlock } from '../src/plugins/code-block.mjs';
import { tableScope } from '../src/plugins/table-scope.mjs';
import { tableStack } from '../src/plugins/table-stack.mjs';
import { tableScroll } from '../src/plugins/table-scroll.mjs';
import {
  CODE_FOLD_MIN_LINES,
  WATCH_OUT_HEADING,
  hasFoldMarkup,
} from '../src/lib/post-folds';
import { BLOG_CONTENT_DIR } from '../src/lib/paths';
import { builtHtml, POST_ROUTES, PUBLISHED_POST_ROUTES } from './routes';
import { NODE } from './tags';
import { NON_TEXT, PAGE_HELPERS } from './contrast';

/** `src/plugins/post-fold.mjs`, `src/scripts/post-folds.ts` and the `.post-fold` rules. */

type Node = Record<string, any>;

const element = (tagName: string, children: Node[] = []): Node => ({
  type: 'element',
  tagName,
  properties: {},
  children,
});

const textOf = (node: Node): string =>
  node.type === 'text'
    ? node.value
    : (node.children ?? []).map(textOf).join('');

/** The visitor's `ctx`, reduced to what it uses; records each replacement. */
const context = (root: Node) => {
  const replaced: { node: Node; by: Node }[] = [];
  const parentOf = (node: Node, from: Node = root): Node | undefined => {
    for (const child of from.children ?? []) {
      if (child === node) return from;
      const found = parentOf(node, child);
      if (found) return found;
    }
    return undefined;
  };
  return {
    replaced,
    ctx: {
      textContent: textOf,
      parent: (node: Node) => parentOf(node),
      indexOf: (node: Node) => parentOf(node)?.children.indexOf(node),
      replaceNode: (node: Node, by: Node) => replaced.push({ node, by }),
    },
  };
};

const POST = { fileURL: 'file:///site/src/content/blog/a.md' };

/** The hast plugin names in `astro.config.mjs`, in order. */
const configPlugins = (): string[] =>
  (
    /hastPlugins:\s*\[([^\]]*)\]/.exec(
      readFileSync('astro.config.mjs', 'utf8'),
    )?.[1] ?? ''
  )
    .split(',')
    .map((name) => name.trim())
    .filter(Boolean);

test('the visitors are registered with the markdown processor', NODE, () => {
  expect(configPlugins(), 'a fold visitor is not in hastPlugins').toEqual(
    expect.arrayContaining(['postFold', 'moduleFold']),
  );
});

test.describe('the post-fold visitor', () => {
  test(
    'folds the list after Watch Out and keeps the heading outside',
    NODE,
    () => {
      const heading = element('h3', [
        { type: 'text', value: WATCH_OUT_HEADING },
      ]);
      const list = element('ul', [element('li'), element('li')]);
      const root = element('div', [
        heading,
        { type: 'text', value: '\n' },
        list,
      ]);
      const { replaced, ctx } = context(root);

      postFold(POST).element.visit(heading, ctx);

      expect(replaced).toHaveLength(1);
      expect(replaced[0]?.node, 'the list, not the heading, folds').toBe(list);
      const [summary, folded] = replaced[0]?.by.children ?? [];
      expect(replaced[0]?.by.tagName).toBe('details');
      expect(summary?.tagName, 'a summary must be the first child').toBe(
        'summary',
      );
      expect(folded).toBe(list);
      expect(textOf(summary)).toContain('2 Surprises');
    },
  );

  test('leaves other h3 lists open', NODE, () => {
    const heading = element('h3', [{ type: 'text', value: 'Steps' }]);
    const root = element('div', [heading, element('ul', [element('li')])]);
    const { replaced, ctx } = context(root);

    postFold(POST).element.visit(heading, ctx);

    expect(replaced).toEqual([]);
  });

  const codeBlock = (lines: number) => {
    const code = element('code', [
      { type: 'text', value: 'line\n'.repeat(lines) },
    ]);
    code.properties = { className: ['language-bash'] };
    return element('pre', [code]);
  };

  test(
    `folds code of ${CODE_FOLD_MIN_LINES} lines or more, named by language and length`,
    NODE,
    () => {
      const pre = codeBlock(CODE_FOLD_MIN_LINES);
      const { replaced, ctx } = context(element('div', [pre]));

      postFold(POST).element.visit(pre, ctx);

      expect(replaced).toHaveLength(1);
      expect(textOf(replaced[0]!.by.children[0])).toContain(
        `Bash Code, ${CODE_FOLD_MIN_LINES} Lines`,
      );
    },
  );

  test('leaves shorter code open', NODE, () => {
    const pre = codeBlock(CODE_FOLD_MIN_LINES - 1);
    const { replaced, ctx } = context(element('div', [pre]));

    postFold(POST).element.visit(pre, ctx);

    expect(replaced).toEqual([]);
  });

  test(
    'folds each module body after its h2, open, with the h2 outside',
    NODE,
    () => {
      const h2 = (value: string) => element('h2', [{ type: 'text', value }]);
      const intro = h2('Before You Start');
      const one = h2('Module 1: Set Up');
      const side = h2('Side Path: Move a Site');
      const after = h2('Between Modules');
      const p = () => element('p');
      const root = element('div', [
        intro,
        p(),
        one,
        p(),
        p(),
        side,
        p(),
        after,
        p(),
      ]);
      let swapped: Node[] = [];
      const ctx = {
        ...context(root).ctx,
        setProperty: (_node: Node, key: string, value: Node[]) => {
          if (key === 'children') swapped = value;
        },
      };

      moduleFold(POST).element.visit(one, ctx);

      const shape = swapped.map((node) =>
        node.tagName === 'details'
          ? `details[${textOf(node.children[0])}:${node.children.length - 1}]`
          : node.tagName === 'div'
            ? 'controls'
            : node.tagName,
      );
      expect(shape).toEqual([
        'h2',
        'p',
        'controls',
        'h2',
        'details[Module 1 Steps:2]',
        'h2',
        'details[Side Path Steps:1]',
        'h2',
        'p',
      ]);
      const folds = swapped.filter((node) => node.tagName === 'details');
      expect(folds.every((fold) => fold.properties.open === true)).toBe(true);
    },
  );

  test('leaves slides alone', NODE, () => {
    const pre = codeBlock(CODE_FOLD_MIN_LINES);
    const { replaced, ctx } = context(element('div', [pre]));

    postFold({
      fileURL: 'file:///site/src/content/talks/a/slides.md',
    }).element.visit(pre, ctx);

    expect(replaced).toEqual([]);
  });
});

/* The site's own pipeline, so the fixture renders as a post would. */
const PLUGINS: Record<string, unknown> = {
  linkListItem,
  postFigure,
  postFold,
  codeBlock,
  tableScope,
  tableStack,
  tableScroll,
  moduleFold,
};

const FIXTURE = 'tests/fixtures/post-folds.md';

type Renderer = Awaited<ReturnType<typeof createSatteriMarkdownProcessor>>;

let pipeline: Promise<Renderer> | undefined;

/** Markdown rendered as a post by the `hastPlugins` in `astro.config.mjs`, in their order. */
const renderPost = async (markdown: string): Promise<string> => {
  pipeline ??= (async () => {
    const names = configPlugins();
    const unknown = names.filter((name) => !(name in PLUGINS));
    expect(
      unknown,
      'hastPlugins has a plugin this spec does not import',
    ).toEqual([]);
    return createSatteriMarkdownProcessor({
      hastPlugins: names.map((name) => PLUGINS[name]) as never,
      syntaxHighlight: false,
    });
  })();
  const { code } = await (
    await pipeline
  ).render(markdown, {
    fileURL: pathToFileURL(join(BLOG_CONTENT_DIR, 'post-folds.md')),
  });
  return code;
};

const renderFixture = (): Promise<string> =>
  renderPost(readFileSync(FIXTURE, 'utf8'));

/* A built page carries the fold script only when its own post has a fold. */
const FOLD_SCRIPT = ts.transpileModule(
  readFileSync('src/scripts/post-folds.ts', 'utf8'),
  { compilerOptions: { target: ts.ScriptTarget.ES2022 } },
).outputText;

const PROSE_OPEN = '<div class="prose">';

/** A built post, the host for the fixture: its template, CSS and scripts are the real ones. */
const FOLD_POST = PUBLISHED_POST_ROUTES[0]!;

/** Serves `FOLD_POST` with the rendered fixture first in its prose and the fold script after it. */
const serveFoldPost = async (page: Page) => {
  const body = await renderFixture();
  await page.route(
    (url) => url.pathname.replace(/\/$/, '') === FOLD_POST,
    async (route) => {
      const response = await route.fetch();
      const html = await response.text();
      expect(html, `${FOLD_POST} has no prose to host the fixture`).toContain(
        PROSE_OPEN,
      );
      await route.fulfill({
        response,
        body: html
          .replace(PROSE_OPEN, `${PROSE_OPEN}${body}`)
          .replace(
            '</body>',
            `<script type="module">${FOLD_SCRIPT}</script></body>`,
          ),
      });
    },
  );
};

/** Opens the fixture post, settled, with an optional hash. */
const gotoFoldPost = async (page: Page, hash = '') => {
  await serveFoldPost(page);
  await gotoSettled(page, `${FOLD_POST}${hash}`);
};

test(
  "renders modules, Watch Out lists and long code as folds through the site's pipeline",
  NODE,
  async () => {
    const html = await renderFixture();
    const count = (pattern: RegExp) => html.match(pattern)?.length ?? 0;

    expect(
      count(/<details class="post-fold" data-module/g),
      'module folds',
    ).toBe(4);
    expect(
      count(/<span class="fold-label">\d+ Surprises?</g),
      'Watch Out folds',
    ).toBe(2);
    expect(
      count(/<span class="fold-label">Bash Code, \d+ Lines</g),
      'code folds',
    ).toBe(1);
  },
);

const NO_FOLD_BODY = 'Text.\n\n## A Heading\n\n### Steps\n\n- One step.\n';

test(
  'hasFoldMarkup, which decides the fold script, finds rendered folds only',
  NODE,
  async () => {
    expect(
      hasFoldMarkup(await renderFixture()),
      'hasFoldMarkup missed the fixture folds',
    ).toBe(true);
    expect(
      hasFoldMarkup(await renderPost(NO_FOLD_BODY)),
      'hasFoldMarkup found a fold in plain text',
    ).toBe(false);
  },
);

test('ends the last module before the footnotes', NODE, async () => {
  const html = await renderFixture();
  const footnotes = html.indexOf('<section data-footnotes');

  expect(footnotes, 'the fixture has no footnotes').toBeGreaterThan(-1);
  expect(
    html.lastIndexOf('</details>'),
    'the footnotes sit inside a fold',
  ).toBeLessThan(footnotes);
});

/* Astro names a component's bundled script after the component file. */
const FOLD_SCRIPT_SRC =
  /<script[^>]+src="[^"]*\/PostFolds\.astro_astro_type_script_/;

test(
  'a built post ships the fold script exactly when it has a fold',
  NODE,
  () => {
    const html = builtHtml();
    const wrong = POST_ROUTES.filter((route) => {
      const page = html.get(route);
      expect(page, `${route} was not built`).toBeDefined();
      return hasFoldMarkup(page!) !== FOLD_SCRIPT_SRC.test(page!);
    });

    expect(POST_ROUTES.length, 'no built post to check').toBeGreaterThan(0);
    expect(
      wrong,
      'posts that ship the fold script without a fold, or a fold without it',
    ).toEqual([]);
  },
);

/** The first Watch Out or code fold: closed on load. */
const firstFold = (page: Page) =>
  page.locator('details.post-fold:not([data-module])').first();

const modules = (page: Page) => page.locator('details[data-module]');

test.describe('a post fold', () => {
  /* SC 2.1.1: Enter and Space toggle it from the keyboard. */
  test('opens and closes from the keyboard', async ({ page }) => {
    await gotoFoldPost(page);
    const fold = firstFold(page);
    const summary = fold.locator('summary');

    await summary.focus();
    await page.keyboard.press('Enter');
    await expect(fold, 'Enter did not open the fold').toHaveAttribute(
      'open',
      '',
    );
    await page.keyboard.press('Space');
    await expect(fold, 'Space did not close the fold').not.toHaveAttribute(
      'open',
    );
  });

  /* SC 4.1.2: the name stays the same across toggles; the expanded state alone changes. */
  test('keeps its name and exposes its state', async ({ page }) => {
    await gotoFoldPost(page);
    const summary = firstFold(page).locator('summary');
    const isOpen = () =>
      summary.evaluate((el) => (el.parentElement as HTMLDetailsElement).open);

    await expect(summary).toHaveAccessibleName(/^\d+ Surprises?$/);
    const name = await summary.evaluate((el) => el.textContent?.trim() ?? '');
    expect(await isOpen()).toBe(false);

    await summary.click();
    expect(await isOpen()).toBe(true);
    await expect(
      summary,
      'the name changed when the fold opened',
    ).toHaveAccessibleName(name);

    await summary.click();
    expect(await isOpen()).toBe(false);
    await expect(
      summary,
      'the name changed when the fold closed',
    ).toHaveAccessibleName(name);
  });

  /* SC 1.3.1, 2.4.6: every Watch Out stays a real h3, outside its fold. */
  test('keeps every Watch Out heading a heading outside the fold', async ({
    page,
  }) => {
    await gotoFoldPost(page);
    const headings = page.getByRole('heading', {
      level: 3,
      name: WATCH_OUT_HEADING,
    });

    const count = await headings.count();
    expect(count, 'the post has no Watch Out heading').toBeGreaterThan(0);
    const inside = await page.locator('details:not([data-module]) h3').count();
    expect(inside, 'a heading sits inside a fold').toBe(0);
  });

  /* SC 2.5.5: the summary is at least 44px tall. */
  test('has a summary at least 44px tall', async ({ page }) => {
    await gotoFoldPost(page);
    const short = await page.evaluate(() =>
      [...document.querySelectorAll('details.post-fold > summary')]
        .map((summary) => summary.getBoundingClientRect().height)
        .filter((height) => height < 44),
    );

    expect(short, 'summaries under 44px tall').toEqual([]);
  });

  /* SC 1.4.11: nothing else delimits the bar, so its edge or its fill reaches 3:1 on the page. */
  for (const colorScheme of ['dark', 'light'] as const) {
    test(`draws every summary's boundary at 3:1 in ${colorScheme} mode`, async ({
      browser,
    }) => {
      const context = await browser.newContext({ colorScheme });
      const page = await context.newPage();
      await gotoFoldPost(page);

      const ratios: number[] = await page.evaluate(`(() => {
        ${PAGE_HELPERS}
        return [...document.querySelectorAll('details.post-fold > summary')].map((summary) => {
          const style = getComputedStyle(summary);
          const ground = effectiveBackground(summary.parentElement);
          const edge = parseFloat(style.borderTopWidth) >= 1 ? parse(style.borderTopColor) : null;
          const fill = parse(style.backgroundColor);
          if (!ground) return 0;
          return Math.max(
            edge ? ratio(over(edge, ground), ground) : 0,
            fill && fill.a === 1 ? ratio(fill, ground) : 0,
          );
        });
      })()`);

      expect(ratios.length, 'the fixture has no fold summary').toBeGreaterThan(
        0,
      );
      expect(
        ratios.filter((value) => value < NON_TEXT),
        'summaries whose edge and fill are both under 3:1',
      ).toEqual([]);
      await context.close();
    });
  }

  /* SC 2.4.3: a link to something inside a closed fold opens it. */
  test('opens for a link to an id inside it', async ({ page }) => {
    await gotoFoldPost(page);
    const fold = firstFold(page);
    await fold.locator(':scope > :not(summary)').evaluate((el) => {
      el.id = 'inside-a-fold';
    });

    await page.evaluate(() => {
      location.hash = 'inside-a-fold';
    });

    await expect(fold, 'the linked fold stayed closed').toHaveAttribute(
      'open',
      '',
    );
    await expect(
      page.locator('#inside-a-fold'),
      'the opened target is out of view',
    ).toBeInViewport();
  });

  /* Function: a malformed escape in the address does not stop the script. */
  test('still wires the buttons after a malformed hash', async ({ page }) => {
    await gotoFoldPost(page, '#50%-off');

    await expect(
      page.getByRole('button', { name: 'Close All Modules' }),
    ).toBeVisible();
  });

  /* Print and paper readers: every fold prints open, then the reader's choice returns. */
  test('opens every fold for print and restores them after', async ({
    page,
  }) => {
    await gotoFoldPost(page);
    const closedCount = () =>
      page.locator('details.post-fold:not([open])').count();
    const closedBefore = await closedCount();
    expect(closedBefore).toBeGreaterThan(0);

    await page.evaluate(() => dispatchEvent(new Event('beforeprint')));
    expect(await closedCount(), 'a fold stayed closed for print').toBe(0);

    await page.evaluate(() => dispatchEvent(new Event('afterprint')));
    expect(await closedCount(), 'print did not restore the folds').toBe(
      closedBefore,
    );
  });

  test('prints a closed fold open without JavaScript', async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await serveFoldPost(page);
    await page.goto(FOLD_POST);
    await page.emulateMedia({ media: 'print' });

    const counts = await page.evaluate(() => {
      const content = [
        ...document.querySelectorAll(
          'details.post-fold:not([open]) > :not(summary)',
        ),
      ];
      return {
        closed: content.length,
        hidden: content.filter((el) => !el.checkVisibility()).length,
      };
    });

    expect(counts.closed, 'the post has no closed fold').toBeGreaterThan(0);
    expect(counts.hidden, 'fold content hidden in print').toBe(0);
    await context.close();
  });

  /* SC 1.3.1, 2.4.6: content everyone needs is never hidden on load; module headings stay headings. */
  test('opens every module on load with its h2 outside', async ({ page }) => {
    await gotoFoldPost(page);
    const count = await modules(page).count();
    expect(count, 'the post has no module fold').toBeGreaterThan(0);

    const closed = await page
      .locator('details[data-module]:not([open])')
      .count();
    expect(closed, 'a module starts closed').toBe(0);
    const outside = await page.evaluate(() =>
      [...document.querySelectorAll('details[data-module]')].every(
        (fold) => fold.previousElementSibling?.tagName === 'H2',
      ),
    );
    expect(outside, 'a module fold does not follow its h2').toBe(true);
    expect(
      await page.locator('details h2').count(),
      'an h2 sits inside a fold',
    ).toBe(0);
  });

  /* SC 4.1.2: a module's name stays the same across toggles. */
  test('keeps a module name the same open or closed', async ({ page }) => {
    await gotoFoldPost(page);
    const summary = modules(page).first().locator(':scope > summary');

    await expect(summary).toHaveAccessibleName(
      /^(Module \d+|Side Path) Steps$/,
    );
    const name = (await summary.textContent())?.trim() ?? '';
    await summary.click();
    await expect(summary).toHaveAccessibleName(name);
    await summary.click();
    await expect(summary).toHaveAccessibleName(name);
  });

  /* SC 2.1.1: the buttons close and open every module, and only modules. */
  test('closes and opens all modules with its buttons', async ({ page }) => {
    await gotoFoldPost(page);
    const extrasOpen = () =>
      page.locator('details.post-fold:not([data-module])[open]').count();
    const extrasBefore = await extrasOpen();

    await page.getByRole('button', { name: 'Close All Modules' }).click();
    expect(await page.locator('details[data-module][open]').count()).toBe(0);
    await page.getByRole('button', { name: 'Open All Modules' }).click();
    expect(await page.locator('details[data-module]:not([open])').count()).toBe(
      0,
    );
    expect(
      await extrasOpen(),
      'the buttons changed a Watch Out or code fold',
    ).toBe(extrasBefore);
  });

  test('hides the module buttons without JavaScript', async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await serveFoldPost(page);
    await page.goto(FOLD_POST);

    await expect(page.locator('.module-controls')).toBeHidden();
    await context.close();
  });

  /* SC 2.4.3: a link to a module heading opens the module a reader closed. */
  test('opens a closed module for a link to its heading', async ({ page }) => {
    await gotoFoldPost(page);
    const fold = modules(page).nth(2);
    const id = await fold.evaluate((el) => el.previousElementSibling?.id ?? '');
    expect(id, 'the module h2 has no id').not.toBe('');

    await fold.locator(':scope > summary').click();
    await expect(fold).not.toHaveAttribute('open');
    await page.locator(`a[href="#${id}"]`).first().click();
    await expect(
      fold,
      'the contents link left the module closed',
    ).toHaveAttribute('open', '');

    await fold.locator(':scope > summary').click();
    await page.evaluate(() => {
      location.hash = '';
    });
    await page.evaluate((target) => {
      location.hash = target;
    }, id);
    await expect(fold, 'the hash left the module closed').toHaveAttribute(
      'open',
      '',
    );
  });

  test('leaves the module buttons out of print', async ({ page }) => {
    await gotoFoldPost(page);
    await page.emulateMedia({ media: 'print' });

    await expect(page.locator('.module-controls')).toBeHidden();
  });

  test('opens closed modules for print', async ({ page }) => {
    await gotoFoldPost(page);
    await page.getByRole('button', { name: 'Close All Modules' }).click();

    await page.evaluate(() => dispatchEvent(new Event('beforeprint')));
    expect(await page.locator('details[data-module]:not([open])').count()).toBe(
      0,
    );
  });
});
