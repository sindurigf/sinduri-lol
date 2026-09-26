import { expect, test, type Page } from './test';
import { gotoSettled } from './settle';
import { MIN_TARGET, REFLOW_VIEWPORT, DESKTOP_VIEWPORT } from './wcag';
import { NON_TEXT, PAGE_HELPERS } from './contrast';
import { NODE } from './tags';
import { readFileSync } from 'node:fs';
import {
  MOVES,
  duration,
  sample,
  walkMove,
  type Move,
} from '../src/lib/about-cats-moves';
import { highestPoint } from '../src/lib/about-cats-rig';

/**
 * The About cats (src/components/ui/AboutCats.vue): real controls that open a
 * photo, an SC 2.2.2 pause, stillness under reduced motion, and never covering
 * text. Their drawing is decoration and is not tested for its look.
 */
const ROUTE = '/about/';
const CATS = ['minerva', 'hela', 'rudra'] as const;
const NAMES = { minerva: 'Minerva', hela: 'Hela', rudra: 'Rudra' } as const;

/** Long enough for several frames of any move; a still cat changes nothing in it. */
const STILL_WINDOW_MS = 800;

const PHONE = { width: 390, height: 844 };

/** About 4.5s per cat: long enough to catch a jump or a rear up. */
const BAND_SAMPLES = 30;
const BAND_SAMPLE_MS = 150;

const catButton = (page: Page, id: (typeof CATS)[number]) =>
  page.getByRole('button', { name: `Meet ${NAMES[id]}` });

/** Every drawn attribute of one cat, so any movement changes the string. */
const drawing = (page: Page, id: (typeof CATS)[number]) =>
  page
    .locator(`#cat-spot-${id} .cat-hit`)
    .evaluate((node) =>
      node.outerHTML.replace(/ (?:x|y|width|height)="[^"]*"/g, ''),
    );

const expectStill = async (
  page: Page,
  id: (typeof CATS)[number],
  why: string,
) => {
  const before = await drawing(page, id);
  await page.waitForTimeout(STILL_WINDOW_MS);
  expect(await drawing(page, id), why).toBe(before);
};

/** A frame at 60fps: fine enough to catch the top of every arc. */
const FRAME_MS = 1000 / 60;

const catBand = (): number => {
  const css = readFileSync('src/styles/global.css', 'utf8');
  const match = /^\s*--spacing-cat-band:\s*(\d+)px;/m.exec(css);
  if (!match) throw new Error('global.css defines no --spacing-cat-band in px');
  return Number(match[1]);
};

test('no move lifts any part of a cat above its band', NODE, () => {
  const band = catBand();
  const moves: [string, Move][] = [
    ...Object.entries(MOVES).map(
      ([name, make]) => [name, make()] as [string, Move],
    ),
    ['walk', walkMove(200)],
  ];
  const tooHigh: string[] = [];
  for (const [name, move] of moves) {
    const start = move.steps[0].pose;
    for (let t = 0; t <= duration(move); t += FRAME_MS) {
      const p = sample(move.steps, start, t);
      for (const mod of move.mods) {
        if (t >= mod.from && t <= mod.to)
          mod.apply(p, t - mod.from, (t - mod.from) / (mod.to - mod.from || 1));
      }
      const height = highestPoint(p);
      if (height > band) {
        tooHigh.push(`${name} at ${Math.round(t)}ms: ${Math.round(height)}px`);
        break;
      }
    }
    if (move.propAt) {
      for (let t = 0; t <= duration(move); t += FRAME_MS) {
        const prop = move.propAt(t);
        if (prop.o > 0 && -prop.y > band) {
          tooHigh.push(`${name}'s ${prop.kind} at ${Math.round(t)}ms`);
          break;
        }
      }
    }
  }
  expect(
    tooHigh,
    'a move rises above --spacing-cat-band into the text above',
  ).toEqual([]);
});

test.describe('About cats', () => {
  test('each cat is a named button that opens its photo in a dialog and returns focus', async ({
    page,
  }) => {
    await gotoSettled(page, ROUTE);
    for (const id of CATS) {
      const button = catButton(page, id);
      await button.focus();
      await page.keyboard.press('Enter');
      const dialog = page.getByRole('dialog', { name: NAMES[id] });
      await expect(
        dialog,
        `${NAMES[id]}'s dialog did not open from the keyboard`,
      ).toBeVisible();
      await expect(
        dialog.getByRole('img'),
        `${NAMES[id]}'s dialog shows no photo with alt text`,
      ).toHaveAttribute('alt', new RegExp(NAMES[id]));
      await page.keyboard.press('Escape');
      await expect(
        dialog,
        `${NAMES[id]}'s dialog did not close on Escape`,
      ).toBeHidden();
      await expect(
        button,
        `focus did not return to ${NAMES[id]} after the dialog closed`,
      ).toBeFocused();
    }
  });

  test('a pointer click on a drawn cat opens its dialog', async ({ page }) => {
    await gotoSettled(page, ROUTE);
    await page.getByRole('button', { name: 'Pause the cats' }).first().click();
    const cat = page.locator('#cat-spot-hela .cat-hit');
    await cat.scrollIntoViewIfNeeded();
    const box = await cat.boundingBox();
    expect(box, 'Hela is not drawn').not.toBeNull();
    if (!box) return;
    await page.mouse.click(box.x + box.width / 2, box.y + box.height * 0.6);
    await expect(page.getByRole('dialog', { name: 'Hela' })).toBeVisible();
  });

  test('the pause control stops every cat and says what it will do (SC 2.2.2)', async ({
    page,
  }) => {
    await gotoSettled(page, ROUTE);
    const pause = page.getByRole('button', { name: 'Pause the cats' });
    await expect(pause, 'each cat needs a pause control beside it').toHaveCount(
      CATS.length,
    );
    for (const toggle of await pause.all()) {
      const box = await toggle.boundingBox();
      expect(
        box?.width,
        'pause control target width (SC 2.5.8)',
      ).toBeGreaterThanOrEqual(MIN_TARGET);
      expect(
        box?.height,
        'pause control target height (SC 2.5.8)',
      ).toBeGreaterThanOrEqual(MIN_TARGET);
    }
    await pause.first().click();
    await expect(
      page.getByRole('button', { name: 'Play the cats' }),
      'every control should switch to Play once paused',
    ).toHaveCount(CATS.length);
    for (const id of CATS) {
      await page.locator(`#cat-spot-${id}`).scrollIntoViewIfNeeded();
      await expectStill(page, id, `${NAMES[id]} kept moving while paused`);
    }
  });

  test('under reduced motion the cats sit still and there is no pause control', async ({
    browser,
  }) => {
    const context = await browser.newContext({ reducedMotion: 'reduce' });
    const page = await context.newPage();
    await gotoSettled(page, ROUTE);
    await expect(page.getByRole('button', { name: /^Meet / })).toHaveCount(
      CATS.length,
    );
    await expect(page.getByRole('button', { name: /the cats$/ })).toHaveCount(
      0,
    );
    for (const id of CATS) {
      await page.locator(`#cat-spot-${id}`).scrollIntoViewIfNeeded();
      await expectStill(page, id, `${NAMES[id]} moved under reduced motion`);
    }
    await context.close();
  });

  test('the cats stop drawing once they are off screen', async ({ page }) => {
    await gotoSettled(page, ROUTE);
    await page.locator('#cat-spot-rudra').scrollIntoViewIfNeeded();
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    for (const id of CATS)
      await expectStill(page, id, `${NAMES[id]} kept drawing off screen`);
  });

  for (const viewport of [REFLOW_VIEWPORT, PHONE, DESKTOP_VIEWPORT]) {
    test(`no cat band or pause control covers text at ${viewport.width}px`, async ({
      browser,
    }) => {
      const context = await browser.newContext({ viewport });
      const page = await context.newPage();
      await gotoSettled(page, ROUTE);
      const overlaps = await page.evaluate(() => {
        const spots = [...document.querySelectorAll<HTMLElement>('.cat-spot')];
        const walker = document.createTreeWalker(
          document.body,
          NodeFilter.SHOW_TEXT,
        );
        const hits: string[] = [];
        for (let node = walker.nextNode(); node; node = walker.nextNode()) {
          const text = node.textContent?.trim();
          const parent = node.parentElement;
          if (
            !text ||
            !parent ||
            parent.closest('.cat-spot, dialog, .sr-only, [hidden]')
          )
            continue;
          const range = document.createRange();
          range.selectNodeContents(node);
          for (const rect of range.getClientRects()) {
            for (const spot of spots) {
              const band = spot.getBoundingClientRect();
              if (
                rect.right > band.left &&
                rect.left < band.right &&
                rect.bottom > band.top &&
                rect.top < band.bottom
              ) {
                hits.push(`${spot.id}: "${text.slice(0, 40)}"`);
              }
            }
          }
        }
        return hits;
      });
      expect(overlaps, 'a cat band overlaps text').toEqual([]);
      await context.close();
    });
  }

  test('a moving cat stays inside its band, so it never covers text', async ({
    page,
  }) => {
    await gotoSettled(page, ROUTE);
    for (const id of CATS) {
      await page.locator(`#cat-spot-${id}`).scrollIntoViewIfNeeded();
      const escapes = await page.evaluate(
        async ({ id, samples, gap }) => {
          const spot = document.getElementById(`cat-spot-${id}`);
          const cat = spot?.querySelector('.cat-hit');
          if (!spot || !cat) return ['not drawn'];
          const out: string[] = [];
          for (let i = 0; i < samples; i += 1) {
            const band = spot.getBoundingClientRect();
            const drawn = cat.getBoundingClientRect();
            if (drawn.top < band.top)
              out.push(`${Math.round(band.top - drawn.top)}px above its band`);
            await new Promise((resolve) => setTimeout(resolve, gap));
          }
          return out;
        },
        { id, samples: BAND_SAMPLES, gap: BAND_SAMPLE_MS },
      );
      expect(escapes, `${NAMES[id]} left its band`).toEqual([]);
    }
  });

  test('a drawn cat is at least 24 by 24px (SC 2.5.8)', async ({ page }) => {
    await gotoSettled(page, ROUTE);
    await page.getByRole('button', { name: 'Pause the cats' }).first().click();
    for (const id of CATS) {
      const box = await page.locator(`#cat-spot-${id} .cat-hit`).boundingBox();
      expect(box?.width, `${NAMES[id]}'s target width`).toBeGreaterThanOrEqual(
        MIN_TARGET,
      );
      expect(
        box?.height,
        `${NAMES[id]}'s target height`,
      ).toBeGreaterThanOrEqual(MIN_TARGET);
    }
  });

  for (const colorScheme of ['dark', 'light'] as const) {
    test(`the sticker edge is at least 3:1 against the page in ${colorScheme} mode (SC 1.4.11)`, async ({
      browser,
    }) => {
      const context = await browser.newContext({ colorScheme });
      const page = await context.newPage();
      await gotoSettled(page, ROUTE);
      const ratios = await page.evaluate(`(() => {
        ${PAGE_HELPERS}
        return [...document.querySelectorAll('.cat-spot')].map((spot) => {
          const edge = spot.querySelector('.cat-edge');
          const fill = edge ? parse(getComputedStyle(edge).fill) : null;
          const ground = effectiveBackground(spot);
          return fill && ground ? ratio(fill, ground) : 0;
        });
      })()`);
      for (const value of ratios as number[]) {
        expect(
          value,
          'the cat edge fails SC 1.4.11 against its ground',
        ).toBeGreaterThanOrEqual(NON_TEXT);
      }
      await context.close();
    });
  }

  test('the drawings are hidden from assistive technology and the AI label is on the page', async ({
    page,
  }) => {
    await gotoSettled(page, ROUTE);
    for (const id of CATS) {
      await expect(page.locator(`#cat-spot-${id} svg`)).toHaveAttribute(
        'aria-hidden',
        'true',
      );
    }
    await expect(
      page.getByText('The moving cats are drawn with AI.'),
    ).toBeVisible();
  });

  test('without JavaScript there are no cats and the AI label stays', async ({
    browser,
  }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto(ROUTE);
    await expect(page.locator('.cat-button')).toHaveCount(0);
    await expect(
      page.getByText('The moving cats are drawn with AI.'),
    ).toBeVisible();
    await context.close();
  });
});
