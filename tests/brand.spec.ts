import { expect, test, type Page } from './test';
import { gotoSettled } from './settle';
import { PAGE_HELPERS } from './contrast';
import { contrastRows } from '../scripts/contrast-table.mjs';

/*
 * /brand states the design system's facts; these tests hold them to the CSS the
 * page ships, so a token cannot change without the page changing with it.
 */
const ROUTE = '/brand/';
const TEMPLATE_URL = 'https://github.com/sindurigf/astro-cat-portfolio';
const USE_TEMPLATE_URL =
  'https://github.com/new?template_name=astro-cat-portfolio&template_owner=sindurigf';
const RATIO_DIGITS = 2;

/** Each `--color-*` token resolved in <main>, where light mode swaps them, as `#rrggbb`. */
const resolveTokens = (page: Page, tokens: string[]) =>
  page.evaluate((names) => {
    const main = document.querySelector('main')!;
    const probe = document.createElement('span');
    main.append(probe);
    const hex = Object.fromEntries(
      names.map((name) => {
        probe.style.color = '';
        probe.style.color = `var(--color-${name})`;
        const [r, g, b] = (
          getComputedStyle(probe).color.match(/\d+/g) ?? []
        ).map(Number);
        return [
          name,
          probe.style.color && r !== undefined
            ? `#${[r, g, b].map((v) => v!.toString(16).padStart(2, '0')).join('')}`.toUpperCase()
            : null,
        ];
      }),
    );
    probe.remove();
    return hex;
  }, tokens);

test.describe('/brand', () => {
  test('the full contrast table lists every pairing the site measures, in order', async ({
    page,
  }) => {
    await gotoSettled(page, ROUTE);
    const pairs = await page
      .locator('#contrast .contrast-dark details tbody tr td:first-child')
      .evaluateAll((cells) =>
        cells.map((cell) =>
          [...cell.querySelectorAll('code')]
            .map((c) => c.textContent)
            .join(' on '),
        ),
      );
    expect(
      pairs,
      'the page drops or reorders a pairing from scripts/contrast-table.mjs',
    ).toEqual(
      contrastRows().map(
        (row: { fg: string; bg: string }) => `${row.fg} on ${row.bg}`,
      ),
    );
  });

  for (const theme of ['dark', 'light'] as const) {
    test(`in ${theme} mode every stated ratio and sample matches the colours the page ships (SC 1.4.3, 1.4.11)`, async ({
      browser,
    }) => {
      const context = await browser.newContext();
      await context.addInitScript(
        (value) => localStorage.setItem('theme', value),
        theme,
      );
      const page = await context.newPage();
      await gotoSettled(page, ROUTE);
      const shown = page.locator(`#contrast .contrast-${theme}`);
      const other = page.locator(
        `#contrast .contrast-${theme === 'dark' ? 'light' : 'dark'}`,
      );
      await expect(shown, `${theme} mode hides its own pairings`).toBeVisible();
      await expect(
        other,
        `${theme} mode shows the other mode's pairings`,
      ).toBeHidden();

      const rows = await shown.locator('tbody tr').evaluateAll((trs) =>
        trs.map((tr) => {
          const [pair, , ratio] = tr.querySelectorAll('td');
          const [fg, bg] = [...pair!.querySelectorAll('code')].map(
            (c) => c.textContent!,
          );
          const sample = pair!.querySelector<HTMLElement>(
            '[aria-hidden="true"]',
          );
          const style = sample && getComputedStyle(sample);
          return {
            fg: fg!,
            bg: bg!,
            stated: /^\d+\.\d+/.exec(ratio!.textContent!.trim())?.[0] ?? '',
            sample: style && {
              fg:
                tr.dataset.sample === 'text'
                  ? style.color
                  : style.borderTopColor,
              bg: style.backgroundColor,
            },
          };
        }),
      );
      expect(rows.length, `${theme} mode lists no pairing`).toBeGreaterThan(0);
      const tokens = [...new Set(rows.flatMap((row) => [row.fg, row.bg]))];
      const hex = await resolveTokens(page, tokens);
      const measured = (await page.evaluate(`(() => {
        ${PAGE_HELPERS}
        const rows = ${JSON.stringify(rows)};
        const hex = ${JSON.stringify(hex)};
        const rgb = (h) => ({ r: parseInt(h.slice(1, 3), 16), g: parseInt(h.slice(3, 5), 16), b: parseInt(h.slice(5, 7), 16), a: 1 });
        const fixed = (value) => value.toFixed(${RATIO_DIGITS});
        return rows.map((row) => ({
          tokens: hex[row.fg] && hex[row.bg] ? fixed(ratio(rgb(hex[row.fg]), rgb(hex[row.bg]))) : 'unresolved',
          sample: row.sample ? fixed(ratio(parse(row.sample.fg), parse(row.sample.bg))) : null,
        }));
      })()`)) as { tokens: string; sample: string | null }[];
      const wrong = rows.flatMap((row, i) => {
        const { tokens: fromTokens, sample } = measured[i]!;
        const name = `${row.fg} on ${row.bg}`;
        return [
          ...(fromTokens === row.stated
            ? []
            : [`${name}: states ${row.stated}, tokens measure ${fromTokens}`]),
          ...(sample === null || sample === row.stated
            ? []
            : [`${name}: states ${row.stated}, its sample paints ${sample}`]),
        ];
      });
      expect(
        wrong,
        `a ${theme} ratio differs from the shipped colours`,
      ).toEqual([]);
      expect(
        rows.filter((row) => row.sample).length,
        `${theme} mode shows no sample`,
      ).toBeGreaterThan(0);
      await context.close();
    });
  }

  for (const theme of ['dark', 'light'] as const) {
    test(`each colour swatch shows the hex its row states in ${theme} mode`, async ({
      browser,
    }) => {
      const context = await browser.newContext();
      await context.addInitScript(
        (value) => localStorage.setItem('theme', value),
        theme,
      );
      const page = await context.newPage();
      await gotoSettled(page, ROUTE);
      const rows = await page
        .locator('#colour li')
        .evaluateAll((items, mode) => {
          /* The last opaque colour in the value: Tailwind lists empty ring and inset layers before a shadow. */
          const hex = (value: string) => {
            const opaque = [...value.matchAll(/rgba?\(([^)]+)\)/g)]
              .map((m) =>
                m[1]!
                  .split(/[,\s/]+/)
                  .filter(Boolean)
                  .map(Number),
              )
              .filter((c) => c.length < 4 || c[3] !== 0);
            const [r, g, b] = opaque.at(-1) ?? [];
            return `#${[r, g, b].map((v) => (v ?? 0).toString(16).padStart(2, '0')).join('')}`.toUpperCase();
          };
          return items.map((item) => {
            const token = item.querySelector('code')!.textContent!;
            const facts = item.querySelectorAll('dd');
            const stated = facts[facts.length - 1]!.textContent!;
            const dark = /Dark (#[0-9A-F]{6})/.exec(stated)?.[1];
            const light = /light (#[0-9A-F]{6})/.exec(stated)?.[1] ?? dark;
            const chip = item.querySelector<HTMLElement>(
              '[aria-hidden="true"]',
            )!;
            const style = getComputedStyle(chip);
            const cls = chip.className;
            /* Each swatch paints its colour where its job puts it. */
            const painted = /\bbg-/.test(cls)
              ? hex(style.backgroundColor)
              : /\bshadow-hard-/.test(cls)
                ? hex(style.boxShadow)
                : /\bborder-8\b/.test(cls)
                  ? hex(style.borderTopColor)
                  : /\btext-/.test(cls) && !/\bborder-dashed\b/.test(cls)
                    ? hex(style.color)
                    : null;
            return { token, want: mode === 'light' ? light : dark, painted };
          });
        }, theme);
      expect(rows.length, 'the colour section lists no colour').toBeGreaterThan(
        0,
      );
      const wrong = rows
        .filter((row) => row.painted !== null && row.painted !== row.want)
        .map(
          (row) => `${row.token}: states ${row.want}, paints ${row.painted}`,
        );
      expect(wrong, `a ${theme} swatch differs from its stated hex`).toEqual(
        [],
      );
      await context.close();
    });
  }

  test('the calls to action open the template, and the demo link waits for the demo', async ({
    page,
  }) => {
    await gotoSettled(page, ROUTE);
    for (const [name, href] of [
      ['Use this design', USE_TEMPLATE_URL],
      ['View the template', TEMPLATE_URL],
    ] as const) {
      const links = page.getByRole('link', { name, exact: true });
      expect(await links.count(), `no "${name}" link`).toBeGreaterThan(0);
      for (const href_ of await links.evaluateAll((all) =>
        all.map((a) => a.getAttribute('href')),
      ))
        expect(href_, `"${name}" points elsewhere`).toBe(href);
    }
    await expect(page.getByRole('link', { name: 'See the demo' })).toHaveCount(
      0,
    );
  });
});
