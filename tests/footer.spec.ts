import { expect, test } from './test';
import {
  EMAIL_LINK_NAME,
  SOCIAL_PROFILES,
  profileLinkName,
} from '../src/lib/profiles';
import { NON_TEXT, PAGE_HELPERS } from './contrast';
import { gotoSettled } from './settle';
import { ENGINE_INVARIANT } from './tags';

/**
 * The footer: the profiles as sticker tiles, the pages and the policies, the
 * copyright, then Lepus Ridet as display type on a gold band with the rabbit on it.
 * A rule engine sees none of the geometry, so what covers what is measured.
 */

const ROUTE = '/about';
const WIDTHS = [390, 820, 1440] as const;
const PHONE_WIDTH = 390;

const EXPECTED_PROFILES = [
  ...SOCIAL_PROFILES.map((profile) => ({
    name: profileLinkName(profile.label),
    href: profile.href as string,
  })),
  { name: EMAIL_LINK_NAME, href: 'mailto:' },
];

test.describe('the footer', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: PHONE_WIDTH, height: 900 });
    await gotoSettled(page, ROUTE);
  });

  test('every profile is a named link to the right place', async ({ page }) => {
    const links = page
      .getByRole('navigation', { name: 'Social' })
      .getByRole('link');
    await expect(links).toHaveCount(EXPECTED_PROFILES.length);

    for (const [index, profile] of EXPECTED_PROFILES.entries()) {
      const link = links.nth(index);
      // The name comes from the visually hidden label alone.
      await expect(link).toHaveAccessibleName(profile.name);
      const href = (await link.getAttribute('href')) ?? '';
      expect(
        profile.href === 'mailto:'
          ? href.startsWith('mailto:')
          : href === profile.href,
        `${profile.name} links to ${href}`,
      ).toBe(true);
    }

    await expect(
      page.locator('.footer-sticker svg:not([aria-hidden="true"])'),
    ).toHaveCount(0);
  });

  test('every sticker icon stands out from its tile', async ({ page }) => {
    const icons = (await page.evaluate(`(() => {
      ${PAGE_HELPERS}
      return [...document.querySelectorAll('.footer-sticker svg')].map((svg) => {
        const tile = compositeBackground(svg.closest('.footer-sticker'));
        const ink = parse(getComputedStyle(svg).fill);
        return {
          name: svg.closest('a').textContent.trim(),
          ratio: tile && ink ? ratio(over(ink, tile), tile) : null,
        };
      });
    })()`)) as { name: string; ratio: number | null }[];

    expect(icons.length, 'no sticker icons were found').toBe(
      EXPECTED_PROFILES.length,
    );
    for (const icon of icons) {
      expect(icon.ratio, `${icon.name} icon is unmeasurable`).not.toBeNull();
      expect(
        icon.ratio!,
        `${icon.name} icon against its tile (SC 1.4.11)`,
      ).toBeGreaterThanOrEqual(NON_TEXT);
    }
  });

  test('Lepus Ridet is Latin text, not a heading', async ({ page }) => {
    const name = page.locator('footer .footer-name');
    await expect(name).toHaveText('Lepus Ridet');
    await expect(name).toHaveAttribute('lang', 'la');
    await expect(page.locator('footer').getByRole('heading')).toHaveCount(0);
  });

  test(
    'the copyright line names the year and the site',
    ENGINE_INVARIANT,
    async ({ page }) => {
      await expect(page.locator('.footer-copyright')).toHaveText(
        /^© \d{4} sinduri\.lol$/,
      );
    },
  );

  // Reading order: on a phone the footer stacks in source order.
  test('the phone stack follows source order', async ({ page }) => {
    const tops = await page.evaluate(() =>
      [
        '.footer-stickers',
        '.footer-pages',
        '.footer-policies',
        '.footer-copyright',
        '.footer-name',
      ].map(
        (selector) =>
          (document.querySelector(selector) as Element).getBoundingClientRect()
            .top,
      ),
    );
    expect(tops, 'the phone stack is out of order').toEqual(
      [...tops].sort((a, b) => a - b),
    );
  });
});

for (const width of WIDTHS) {
  test.describe(`the footer at ${width}px`, () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await gotoSettled(page, ROUTE);
    });

    test('nothing covers a footer link', async ({ page }) => {
      const covered = await page.evaluate(() => {
        const out: string[] = [];
        for (const link of document.querySelectorAll('footer a')) {
          link.scrollIntoView({ block: 'center' });
          const box = link.getBoundingClientRect();
          /* A link that is not rendered, such as the no-script fallback, covers nothing; a collapsed one still fails. */
          if (!link.checkVisibility()) continue;
          const hit = document.elementFromPoint(
            box.left + box.width / 2,
            box.top + box.height / 2,
          );
          if (!hit || !link.contains(hit)) {
            out.push(
              `${link.textContent?.trim()} is under ` +
                `${hit ? hit.outerHTML.slice(0, 80) : 'nothing'}`,
            );
          }
        }
        return out;
      });
      expect(covered, 'footer links with something drawn over them').toEqual(
        [],
      );
    });

    test('the rabbit is decoration and sits clear of the links and the copyright', async ({
      page,
    }) => {
      const m = await page.evaluate(() => {
        const rabbit = document.querySelector(
          '.footer-rabbit',
        ) as HTMLImageElement;
        /* The rabbit, and the Tickle the Rabbit button drawn over it. */
        const boxes = [
          rabbit,
          ...document.querySelectorAll('[data-rabbit-tickle]'),
        ].map((el) => el.getBoundingClientRect());
        const overlapping = [
          ...document.querySelectorAll('footer a, .footer-copyright'),
        ]
          .filter((el) => {
            const other = el.getBoundingClientRect();
            return boxes.some(
              (box) =>
                !(
                  other.right <= box.left ||
                  other.left >= box.right ||
                  other.bottom <= box.top ||
                  other.top >= box.bottom
                ),
            );
          })
          .map((el) => el.textContent?.trim() || el.outerHTML.slice(0, 60));
        return {
          alt: rabbit.getAttribute('alt'),
          inLink: rabbit.closest('a, button') !== null,
          overlapping,
        };
      });

      expect(m.alt, 'the footer rabbit needs an empty alt').toBe('');
      expect(m.inLink, 'the footer rabbit sits inside a control').toBe(false);
      expect(m.overlapping, 'text the rabbit is drawn over').toEqual([]);
    });

    test('the rabbit stands on the last letter of the name, sunk no deeper than its rim', async ({
      page,
    }) => {
      const m = await page.evaluate(() => {
        const text = document.querySelector('.footer-name-text') as HTMLElement;
        const rabbit = document.querySelector('.footer-rabbit') as HTMLElement;
        const node = [...text.childNodes].find(
          (n) => n.nodeType === Node.TEXT_NODE && n.textContent?.trim(),
        ) as Text;
        const glyphs = [...node.data]
          .map((ch, i) => {
            const range = document.createRange();
            range.setStart(node, i);
            range.setEnd(node, i + 1);
            return { ch, box: range.getBoundingClientRect() };
          })
          .filter((g) => g.ch.trim() && g.box.width > 0);
        const firstTop = Math.min(...glyphs.map((g) => g.box.top));
        const firstLine = glyphs.filter((g) => g.box.top - firstTop < 1);
        const last = firstLine[firstLine.length - 1]!.box;
        const r = rabbit.getBoundingClientRect();
        const fontSize = parseFloat(getComputedStyle(text).fontSize);
        return {
          center: r.left + r.width / 2,
          glyphLeft: last.left,
          glyphRight: last.right,
          sink: r.bottom - text.getBoundingClientRect().top,
          maxSink: 0.04 * fontSize + 0.09 * r.height + 1,
        };
      });
      expect(
        m.center,
        'the rabbit stands left of the last letter of the first line',
      ).toBeGreaterThanOrEqual(m.glyphLeft);
      expect(
        m.center,
        'the rabbit stands past the last letter of the first line',
      ).toBeLessThanOrEqual(m.glyphRight);
      expect(
        m.sink,
        'the rabbit sinks into the name deeper than its rim and the cap gap',
      ).toBeLessThanOrEqual(m.maxSink);
    });
  });
}

/* Tickle the Rabbit (src/scripts/rabbit-tickle.ts): the band's one control, loaded on demand. */
const TICKLE = { name: 'Tickle the Rabbit' };
const TARGET_MIN = 44;

test.describe('Tickle the Rabbit', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: PHONE_WIDTH, height: 900 });
    await gotoSettled(page, ROUTE);
  });

  test('is the only control on the name band and a 44px target (SC 2.5.5)', async ({
    page,
  }) => {
    const band = page.locator('.footer-name');
    await expect(
      band.locator('a, button, input, select, textarea, [tabindex]'),
    ).toHaveCount(1);
    const button = band.getByRole('button', TICKLE);
    await expect(button).toBeVisible();
    const box = (await button.boundingBox())!;
    expect(
      box.width,
      'the button is narrower than 44px',
    ).toBeGreaterThanOrEqual(TARGET_MIN);
    expect(
      box.height,
      'the button is shorter than 44px',
    ).toBeGreaterThanOrEqual(TARGET_MIN);
    await expect(page.locator('.footer-rabbit')).toHaveAttribute('alt', '');
  });

  test('a press from the keyboard makes the rabbit giggle and says so (SC 4.1.3)', async ({
    page,
  }) => {
    const button = page.getByRole('button', TICKLE);
    await button.focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('footer').getByRole('status')).toHaveText(
      'The rabbit giggles.',
    );
    await expect(page.locator('.footer-rabbit')).toHaveCSS(
      'animation-name',
      'rabbit-giggle',
    );
    await expect(page.locator('.footer-name-text')).toHaveCSS(
      'animation-name',
      'name-laugh',
    );
  });

  test('under reduced motion only blinks (SC 2.3.3)', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.getByRole('button', TICKLE).click();
    await expect(page.locator('footer').getByRole('status')).toHaveText(
      'The rabbit giggles.',
    );
    await expect(page.locator('.footer-rabbit')).toHaveCSS(
      'animation-name',
      'rabbit-blink',
    );
    await expect(page.locator('.footer-name-text')).toHaveCSS(
      'animation-name',
      'none',
    );
  });
});

test('without JavaScript the rabbit is a plain image and no button shows', async ({
  browser,
  baseURL,
}) => {
  const context = await browser.newContext({
    baseURL,
    javaScriptEnabled: false,
  });
  const page = await context.newPage();
  await page.goto(ROUTE);
  await expect(page.getByRole('button', TICKLE)).toHaveCount(0);
  await expect(page.locator('.footer-rabbit')).toBeVisible();
  await context.close();
});

/* The footer follows the mode like the page: its words reach AAA and its tiles stand apart from it in both. */
const AAA_TEXT = 7;

for (const colorScheme of ['dark', 'light'] as const) {
  test.describe(`the footer in ${colorScheme} mode`, () => {
    test.use({ colorScheme });

    test('takes the page ground, its words reach 7:1 and its tiles stand apart', async ({
      page,
    }) => {
      await gotoSettled(page, ROUTE);
      const found = (await page.evaluate(`(() => {
        ${PAGE_HELPERS}
        const footer = document.querySelector('footer');
        const ground = effectiveBackground(footer);
        const page = effectiveBackground(document.querySelector('main'));
        const name = document.querySelector('.footer-name');
        const nameRatio = ratio(parse(getComputedStyle(name).color), effectiveBackground(name));
        const words = [...footer.querySelectorAll('a, small')]
          .filter((el) => el.checkVisibility() && el.textContent.trim() && !el.closest('.footer-sticker'))
          .map((el) => ({ text: el.textContent.trim().slice(0, 20), ratio: ratio(parse(getComputedStyle(el).color), ground) }));
        const tiles = [...footer.querySelectorAll('.footer-sticker')]
          .map((tile) => ratio(parse(getComputedStyle(tile).backgroundColor), ground));
        return { same: ground && page && ratio(ground, page) < 1.01, words, tiles, nameRatio };
      })()`)) as {
        same: boolean;
        nameRatio: number;
        words: { text: string; ratio: number }[];
        tiles: number[];
      };
      expect(found.same, 'the footer ground differs from the page').toBe(true);
      expect(found.words.length, 'no footer words were found').toBeGreaterThan(
        1,
      );
      for (const word of found.words) {
        expect(
          word.ratio,
          `"${word.text}" on the footer (SC 1.4.6)`,
        ).toBeGreaterThanOrEqual(AAA_TEXT);
      }
      expect(
        found.nameRatio,
        'Lepus Ridet on its gold band (SC 1.4.6)',
      ).toBeGreaterThanOrEqual(AAA_TEXT);
      for (const tile of found.tiles) {
        expect(
          tile,
          'a sticker tile on the footer (SC 1.4.11)',
        ).toBeGreaterThanOrEqual(NON_TEXT);
      }
    });
  });
}
