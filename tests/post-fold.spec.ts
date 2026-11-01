import { readFileSync } from 'node:fs';
import { expect, test, type Page } from './test';
import { gotoSettled } from './settle';
import { moduleFold, postFold } from '../src/plugins/post-fold.mjs';
import {
  CODE_FOLD_MIN_LINES,
  WATCH_OUT_HEADING,
  hasFold,
} from '../src/lib/post-folds';
import { builtHtml } from './routes';
import { NODE } from './tags';

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

test('the visitor is registered with the markdown processor', NODE, () => {
  const config = readFileSync('astro.config.mjs', 'utf8');
  const processor = /hastPlugins:\s*\[([^\]]*)\]/.exec(config)?.[1] ?? '';

  expect(
    processor.split(',').map((name) => name.trim()),
    'postFold is not registered in hastPlugins',
  ).toContain('postFold');
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
      const intro = h2('The Path at a Glance');
      const one = h2('Module 1: Try Discourse');
      const side = h2('Side Path: Move an Existing Site');
      const after = h2('Where to Go Next');
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

test(
  'hasFold finds a Watch Out list or long code, and passes the rest',
  NODE,
  () => {
    expect(hasFold(`Text.\n\n### ${WATCH_OUT_HEADING}\n\n- a\n`)).toBe(true);
    expect(
      hasFold(`\`\`\`sh\n${'x\n'.repeat(CODE_FOLD_MIN_LINES)}\`\`\`\n`),
    ).toBe(true);
    expect(
      hasFold(`\`\`\`sh\n${'x\n'.repeat(CODE_FOLD_MIN_LINES - 1)}\`\`\`\n`),
    ).toBe(false);
    expect(hasFold('### Steps\n\n- a\n')).toBe(false);
  },
);

/** The first post route whose built HTML has a fold. */
const foldPost = (): string => {
  const route = [...builtHtml()].find(([, html]) =>
    html.includes('class="post-fold"'),
  )?.[0];
  expect(route, 'no built post has a fold to test').toBeDefined();
  return route!;
};

/** The first Watch Out or code fold: closed on load. */
const firstFold = (page: Page) =>
  page.locator('details.post-fold:not([data-module])').first();

const modules = (page: Page) => page.locator('details[data-module]');

test.describe('a post fold', () => {
  /* SC 2.1.1: Enter and Space toggle it from the keyboard. */
  test('opens and closes from the keyboard', async ({ page }) => {
    await gotoSettled(page, foldPost());
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
    await gotoSettled(page, foldPost());
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
    await gotoSettled(page, foldPost());
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
    await gotoSettled(page, foldPost());
    const short = await page.evaluate(() =>
      [...document.querySelectorAll('details.post-fold > summary')]
        .map((summary) => summary.getBoundingClientRect().height)
        .filter((height) => height < 44),
    );

    expect(short, 'summaries under 44px tall').toEqual([]);
  });

  /* SC 2.4.3: a link to something inside a closed fold opens it. */
  test('opens for a link to an id inside it', async ({ page }) => {
    await gotoSettled(page, foldPost());
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
  });

  /* Print and paper readers: every fold prints open, then the reader's choice returns. */
  test('opens every fold for print and restores them after', async ({
    page,
  }) => {
    await gotoSettled(page, foldPost());
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
    await page.goto(foldPost());
    await page.emulateMedia({ media: 'print' });

    const hidden = await page.evaluate(
      () =>
        [
          ...document.querySelectorAll(
            'details.post-fold:not([open]) > :not(summary)',
          ),
        ].filter((el) => el.getBoundingClientRect().height === 0).length,
    );

    expect(hidden, 'fold content hidden in print').toBe(0);
    await context.close();
  });

  /* SC 1.3.1, 2.4.6: content everyone needs is never hidden on load; module headings stay headings. */
  test('opens every module on load with its h2 outside', async ({ page }) => {
    await gotoSettled(page, foldPost());
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
    await gotoSettled(page, foldPost());
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
    await gotoSettled(page, foldPost());
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
    await page.goto(foldPost());

    await expect(page.locator('.module-controls')).toBeHidden();
    await context.close();
  });

  /* SC 2.4.3: a link to a module heading opens the module a reader closed. */
  test('opens a closed module for a link to its heading', async ({ page }) => {
    await gotoSettled(page, foldPost());
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

  test('opens closed modules for print', async ({ page }) => {
    await gotoSettled(page, foldPost());
    await page.getByRole('button', { name: 'Close All Modules' }).click();

    await page.evaluate(() => dispatchEvent(new Event('beforeprint')));
    expect(await page.locator('details[data-module]:not([open])').count()).toBe(
      0,
    );
  });
});
