import { expect, test, type Page } from '@playwright/test';
import { ROUTES } from './routes';

/**
 * Windows High Contrast Mode, which the platform exposes to CSS as
 * `forced-colors: active`.
 *
 * WHAT IT DOES. The user agent throws away the author's palette and repaints
 * the page in a system one: background, text, links, buttons and the focus
 * ring all come from the reader's chosen scheme. Author colours are ignored,
 * and — this is the part that matters here — **every box-shadow is
 * suppressed**. Measured on this site, 2026-09-05: `/`, `/career` and `/blog`
 * render with zero elements still painting a shadow, out of 227, 181 and 241
 * elements respectively.
 *
 * WHY THAT MATTERS TO THIS DESIGN IN PARTICULAR. The comps lean on
 * `shadow-hard-*` for the offset blocks that give cards and buttons their
 * shape. Every one of those disappears in forced colours. Anything whose only
 * boundary is a shadow becomes a shape with no edges — and nothing in this
 * repository was looking, because nothing in it had ever set this media
 * feature.
 *
 * ────────────────────────────────────────────────────────────────────────
 * WHY EVERY TEST CHECKS THE EMULATION BEFORE IT CHECKS ANYTHING ELSE.
 *
 * On @playwright/test 1.62.1, which is the version this file was written
 * against, `test.use({ forcedColors: 'active' })` silently did nothing. It is
 * the idiomatic form and the one every other spec here uses for `viewport`; it
 * raised no error, and the page it handed you had
 * `matchMedia('(forced-colors: active)').matches === false`. Measured at module
 * scope and inside a describe block, on chromium 151.0.7922.34: false in both.
 * A file written the obvious way would have asserted against the ordinary
 * rendering and passed for the wrong reason.
 *
 * **That is fixed in 1.63.0.** Re-measured on the upgrade, chromium 153 and
 * firefox 153: `test.use` now reports true in both engines, as do
 * `emulateMedia` and `browser.newContext`. So the paragraph above is history
 * rather than a live warning, and it is kept as history because the guard it
 * produced is the reason the bug was survivable.
 *
 * THE GUARD STAYS, and not out of sentiment. It costs one `matchMedia` call
 * per test and it is the only thing standing between this file and 25 passing
 * tests that exercised nothing. It caught a real Playwright regression once
 * already; it is what proved the emulation genuinely activates in Firefox when
 * that engine was added, rather than leaving it assumed; and it is what will
 * catch the next engine or version where the feature quietly stops applying.
 * A test that cannot tell "the page is fine" from "the page was never asked"
 * is not a test. This file uses `emulateMedia` rather than `test.use` for the
 * same reason: it is the form that was never broken.
 * ────────────────────────────────────────────────────────────────────────
 *
 * WHAT IS ASSERTED, AND WHY EACH SURVIVES A REDESIGN.
 *
 *   1. The emulation took effect. See above.
 *   2. Nothing opts out. `forced-color-adjust` other than `auto` tells the
 *      browser to keep the author's colours, which defeats the accommodation
 *      for the reader who asked for it. Zero elements opt out today and this
 *      keeps it that way.
 *   3. Every control that is not a link keeps a boundary that is not a shadow
 *      — a painted border or an opaque background. Buttons are the case: a
 *      link is given LinkText by the user agent and reads as a link on that
 *      alone, a button is not.
 *   4. Links are painted in a colour distinct from body text, which is the
 *      user agent's own accommodation and the reason (3) exempts them.
 *      Asserted rather than assumed.
 *   5. The focus indicator survives with a non-zero width.
 *
 * VERIFIED ABLE TO FAIL. A <button> appended with `border:0`,
 * `background:transparent` and an 8px hard shadow — the exact shape this file
 * exists to catch — is reported by the boundary check, which finds nothing on
 * the untouched page. `forced-color-adjust: none` added to `.card` takes the
 * opt-out count from 0 to 80. Measured 2026-09-05.
 *
 * WHY LINKS ARE EXEMPT FROM (3), MEASURED RATHER THAN ASSUMED. 26 distinct
 * controls on this site have neither a painted border nor an opaque background
 * under forced colours, and every single one is an `<a>`: the wordmark, the
 * category filters, the card headings, the prose links on /contact, the pager.
 * No button, input or summary is among them. Requiring a border of all of them
 * would be requiring the design to draw boxes round prose links, which is not
 * what the criterion asks for and is not what a reader in this mode needs.
 */

/** Controls that carry no user-agent affordance of their own in this mode. */
const NON_LINK_CONTROLS =
  'button, input, select, textarea, summary, [tabindex]:not([tabindex="-1"]):not(a)';

/** Assert the emulation is on. Every test calls this first; see the note above. */
const forceColours = async (page: Page, route: string): Promise<void> => {
  await page.emulateMedia({ forcedColors: 'active' });
  const active = await page.evaluate(
    () => matchMedia('(forced-colors: active)').matches,
  );
  expect(
    active,
    `forced-colors is not active on ${route}, so nothing below is being ` +
      `tested. Do not switch this file to test.use({ forcedColors }): that ` +
      `form silently does nothing here, which is why this check exists.`,
  ).toBe(true);
};

type Unbounded = { tag: string; text: string; display: string };

const withoutABoundary = (page: Page): Promise<Unbounded[]> =>
  page.evaluate((selector) => {
    const transparent = (colour: string) =>
      colour === 'transparent' || /,\s*0\)$/.test(colour);

    const out: Unbounded[] = [];
    for (const element of document.querySelectorAll(selector)) {
      const style = getComputedStyle(element);
      const sides = ['Top', 'Right', 'Bottom', 'Left'] as const;

      const hasBorder = sides.some((side) => {
        const width = parseFloat(
          style.getPropertyValue(`border-${side.toLowerCase()}-width`),
        );
        const colour = style.getPropertyValue(
          `border-${side.toLowerCase()}-color`,
        );
        return width > 0 && !transparent(colour);
      });
      const hasFill = !transparent(style.backgroundColor);

      /*
       * box-shadow is deliberately not consulted. In this mode it paints
       * nothing, so a control relying on it is a control with no edges, which
       * is the whole point of the file.
       */
      if (hasBorder || hasFill) continue;

      out.push({
        tag: element.tagName.toLowerCase(),
        text: (element.textContent ?? '').trim().slice(0, 40),
        display: style.display,
      });
    }
    return out;
  }, NON_LINK_CONTROLS) as Promise<Unbounded[]>;

test.describe('forced colours', () => {
  for (const route of ROUTES) {
    test(`${route} holds up in forced colours`, async ({ page }) => {
      await page.goto(route, { waitUntil: 'networkidle' });
      await forceColours(page, route);

      const optedOut = await page.evaluate(() =>
        [...document.querySelectorAll('*')]
          .filter((element) => {
            const value = getComputedStyle(element).forcedColorAdjust;
            return Boolean(value) && value !== 'auto';
          })
          .map(
            (element) =>
              `<${element.tagName.toLowerCase()} class="${element.getAttribute('class') ?? ''}">`,
          )
          .slice(0, 10),
      );
      expect(
        optedOut,
        `${route} has element(s) with forced-color-adjust other than auto. ` +
          `That keeps the author palette and defeats the accommodation for a ` +
          `reader who has asked the operating system for their own.`,
      ).toEqual([]);

      const unbounded = await withoutABoundary(page);
      expect(
        unbounded,
        `${route} has non-link control(s) with neither a painted border nor ` +
          `an opaque background in forced colours, where box-shadow paints ` +
          `nothing. They have no edges for a reader in this mode:\n` +
          unbounded
            .map(
              (c) =>
                `  <${c.tag} display:${c.display}> ${JSON.stringify(c.text)}`,
            )
            .join('\n'),
      ).toEqual([]);

      const colours = await page.evaluate(() => {
        const link = document.querySelector('main a[href], a[href]');
        return {
          body: getComputedStyle(document.body).color,
          link: link ? getComputedStyle(link).color : null,
        };
      });
      expect(
        colours.link,
        `${route} paints its links in the same colour as body text in forced ` +
          `colours (${colours.body}). Links are exempt from needing a border ` +
          `here precisely because the user agent distinguishes them; if that ` +
          `stops being true the exemption stops being sound.`,
      ).not.toBe(colours.body);
    });
  }

  test('the focus indicator survives forced colours', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });
    await forceColours(page, '/');
    await page.keyboard.press('Tab');

    const ring = await page.evaluate(() => {
      const element = document.activeElement as HTMLElement;
      const style = getComputedStyle(element);
      return {
        name: (element.textContent ?? '').trim().slice(0, 40),
        width: parseFloat(style.outlineWidth),
        style: style.outlineStyle,
      };
    });

    expect(
      ring.width,
      `the first focus stop (${ring.name}) has no outline width in forced ` +
        `colours. SC 2.4.7 does not stop applying because the palette changed.`,
    ).toBeGreaterThan(0);
    expect(ring.style).not.toBe('none');
  });

  test('the mobile menu holds up in forced colours at 320px', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 720 });
    await page.goto('/', { waitUntil: 'networkidle' });
    await forceColours(page, '/ (menu open)');

    const trigger = page.getByRole('button', { name: /menu/i });
    await trigger.click();
    await expect(
      page.getByRole('dialog'),
      'the panel must be open, or this is the closed-state check again',
    ).toBeVisible();

    const unbounded = await withoutABoundary(page);
    expect(
      unbounded,
      `the open mobile menu has non-link control(s) with no boundary in ` +
        `forced colours:\n` +
        unbounded
          .map(
            (c) =>
              `  <${c.tag} display:${c.display}> ${JSON.stringify(c.text)}`,
          )
          .join('\n'),
    ).toEqual([]);
  });
});
