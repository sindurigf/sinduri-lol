import { expect, test } from './test';
import { gotoSettled } from './settle';
import { BRAND_PATH, BRAND_SECTIONS } from '../src/lib/brand-sections';
import { PART_ACCESSIBILITY } from '../src/lib/brand-a11y';

test.describe('/brand guide', () => {
  test('the page opens with how to use it, before the first section (SC 3.3.5)', async ({
    page,
  }) => {
    await gotoSettled(page, BRAND_PATH);
    const guide = page.locator('.brand-guide');
    await expect(guide.getByRole('listitem')).toHaveCount(3);
    const before = await page.evaluate(
      () =>
        document
          .querySelector('.brand-guide')!
          .compareDocumentPosition(document.querySelector('#grounds')!) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    );
    expect(before, 'the guide comes after the first section').toBeTruthy();
  });

  test('the hover and pressed samples look like the real states of the button (SC 1.4.1, 1.4.11)', async ({
    page,
  }) => {
    await gotoSettled(page, BRAND_PATH);
    const real = page.locator('#primary-button ~ div a.btn-primary').first();
    await real.scrollIntoViewIfNeeded();
    const look = (loc: typeof real) =>
      loc.evaluate((el) => {
        const s = getComputedStyle(el);
        return {
          background: s.backgroundColor,
          color: s.color,
          shadow: s.boxShadow,
          translate: s.translate,
        };
      });
    const rest = await look(real);
    const box = (await real.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    const hovered = await look(real);
    await page.mouse.down();
    const pressed = await look(real);
    await page.mouse.up();
    const sample = (state: string) =>
      page
        .locator(
          `[data-component="primary-button"] .brand-stage-half.mode-dark .${state}`,
        )
        .first();
    const hoverSample = await look(sample('state-hover'));
    const pressSample = await look(sample('state-pressed'));
    expect(hovered.background, 'hover must change the fill').not.toBe(
      rest.background,
    );
    expect(hoverSample.background).toBe(hovered.background);
    expect(hoverSample.color).toBe(hovered.color);
    expect(pressSample.shadow).toBe(pressed.shadow);
    expect(pressSample.translate).toBe(pressed.translate);
  });

  test('each example shows its HTML under it and the code never scrolls sideways at 320px (SC 1.4.10, 2.1.1)', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    await gotoSettled(page, BRAND_PATH);
    const blocks = await page
      .locator('li[data-component]')
      .evaluateAll((rows) =>
        rows.flatMap((row) => {
          const code = row.querySelector<HTMLElement>('pre.brand-code');
          if (!code) return [];
          const label = code.previousElementSibling;
          return [
            {
              part: row.getAttribute('data-component'),
              label: label?.textContent?.trim(),
              text: code.textContent ?? '',
              scrolls: code.scrollWidth > code.clientWidth,
              scoped: /data-astro/.test(code.textContent ?? ''),
            },
          ];
        }),
      );
    expect(blocks.length, 'no example shows its HTML').toBeGreaterThan(0);
    const wrong = blocks.flatMap((b) => [
      ...(b.label === 'HTML'
        ? []
        : [`${b.part}: the code has no visible label`]),
      ...(b.text.includes('<') ? [] : [`${b.part}: the code shows no markup`]),
      ...(b.scrolls ? [`${b.part}: the code scrolls sideways`] : []),
      ...(b.scoped ? [`${b.part}: the code shows build attributes`] : []),
    ]);
    expect(wrong).toEqual([]);
  });

  test('every part that has an accessibility line shows it once, after its rule (SC 1.3.1)', async ({
    page,
  }) => {
    await gotoSettled(page, BRAND_PATH);
    const shown = await page.locator('li[data-component]').evaluateAll((rows) =>
      rows.flatMap((row) => {
        const line = [...row.querySelectorAll('p')].find(
          (p) =>
            p.firstElementChild?.matches('b') &&
            p.firstElementChild.textContent === 'Accessibility',
        );
        return line
          ? [
              [
                row.getAttribute('data-component'),
                line.textContent?.slice(13).trim(),
              ],
            ]
          : [];
      }),
    );
    expect(Object.fromEntries(shown)).toEqual(PART_ACCESSIBILITY);
  });

  test("each do and don't pair names both sides in words and hides its samples (SC 1.4.1)", async ({
    page,
  }) => {
    await gotoSettled(page, BRAND_PATH);
    const pairs = await page
      .locator('[data-example] .brand-pair')
      .evaluateAll((all) =>
        all.map((el) => ({
          label: el.querySelector('.label')?.textContent?.trim(),
          hidden: el
            .querySelector('.brand-pair-sample')
            ?.getAttribute('aria-hidden'),
          words:
            el.querySelector('p:last-child')?.textContent?.trim().length ?? 0,
        })),
      );
    expect(pairs.map((p) => p.label)).toEqual(['Do', "Don't", 'Do', "Don't"]);
    expect(pairs.every((p) => p.hidden === 'true' && p.words > 0)).toBe(true);
  });

  test('typing in the filter narrows the sections list and says how many remain, clearing restores it (SC 3.3.2, 4.1.3)', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await gotoSettled(page, BRAND_PATH);
    const wide = page.locator('[data-menu-wide]');
    const links = wide.locator('a.brand-menu-link');
    const filter = wide.getByLabel('Filter');
    await expect(links.locator('visible=true')).toHaveCount(
      BRAND_SECTIONS.length,
    );
    await filter.fill('color');
    await expect(links.locator('visible=true')).toHaveCount(1);
    await expect(wide.getByRole('status')).toHaveText('1 section');
    await filter.fill('');
    await expect(links.locator('visible=true')).toHaveCount(
      BRAND_SECTIONS.length,
    );
    await expect(wide.getByRole('status')).toHaveText(
      `${BRAND_SECTIONS.length} sections`,
    );
    await filter.fill('zzz');
    await expect(links.locator('visible=true')).toHaveCount(0);
    await expect(wide.getByRole('status')).toHaveText('0 sections');
  });
});
