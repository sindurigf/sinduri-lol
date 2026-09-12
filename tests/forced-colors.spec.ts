import { expect, test, type Page } from '@playwright/test';
import { gotoSettled } from './settle';
import { ROUTES } from './routes';
import { GLOBAL_CSS, cssColorToken } from './source';

/**
 * Windows High Contrast Mode, which the platform exposes to CSS as
 * `forced-colors: active`.
 *
 * What it does: the user agent throws away the author's palette and repaints
 * the page in a system one, so background, text, links, buttons and the focus
 * ring all come from the reader's chosen scheme. Author colours are ignored,
 * and every box-shadow is suppressed. Measured 2026-09-05: no element on `/`,
 * `/career` or `/blog` still paints a shadow.
 *
 * That matters to this design in particular. The comps lean on `shadow-hard-*`
 * for the offset blocks that give cards and buttons their shape, and every one
 * of those disappears in forced colours. Anything whose only boundary is a
 * shadow becomes a shape with no edges, and nothing in this repository was
 * looking, because nothing in it had ever set this media feature.
 *
 * WHY EVERY TEST CHECKS THE EMULATION FIRST. On @playwright/test 1.62.1, which
 * this suite is pinned to, `test.use({ forcedColors: 'active' })` silently does
 * nothing: it is the idiomatic form, it raises no error, and the page it hands
 * back has `matchMedia('(forced-colors: active)').matches === false`. 1.63.0
 * fixed that, but the pin stands because 1.63.0 stalls Firefox navigations, see
 * the note on the pin in playwright.config.ts. So the bug is live in the
 * version this runs on, and switching this file to the idiomatic form would
 * break it silently. This file uses `emulateMedia`, the form that was never
 * broken.
 *
 * The guard costs one `matchMedia` call per test and is the only thing between
 * this file and a block of passing tests that exercised nothing. It caught
 * that Playwright bug; it is what proved the emulation genuinely activates in
 * Firefox when that engine was added, rather than leaving it assumed; and it
 * is what will catch the next engine or version where the feature quietly
 * stops applying.
 *
 * What is asserted, and why each survives a redesign:
 *
 *   1. The emulation took effect. See above.
 *   2. Nothing opts out. `forced-color-adjust` other than `auto` tells the
 *      browser to keep the author's colours, which defeats the accommodation
 *      for the reader who asked for it. Zero elements opt out today.
 *   3. Every control that is not a link keeps a boundary that is not a shadow:
 *      a painted border or an opaque background. Buttons are the case, because
 *      the user agent gives a link LinkText and it reads as a link on that
 *      alone, where a button does not.
 *   4. Links are painted in a colour distinct from body text, which is the
 *      user agent's own accommodation and the reason (3) exempts them.
 *      Asserted rather than assumed.
 *   5. The focus indicator survives with a non-zero width.
 *
 * Verified 2026-09-05: a <button> appended with `border:0`,
 * `background:transparent` and an 8px hard shadow, the exact shape this file
 * exists to catch, is reported by the boundary check, which finds nothing on
 * the untouched page; `forced-color-adjust: none` added to `.card` takes the
 * opt-out count from 0 to 80.
 *
 * The exemption in (3) is measured rather than assumed. Every control on this
 * site with neither a painted border nor an opaque background under forced
 * colours is an `<a>`: the wordmark, the category filters, the card headings,
 * the prose links on /contact, the pager. No button, input or summary is among
 * them. Requiring a border of all of them would mean drawing boxes round prose
 * links, which is not what the criterion asks for and not what a reader in
 * this mode needs.
 */

interface Rgb {
  r: number;
  g: number;
  b: number;
}

/**
 * The authored body text colour, read out of the stylesheet rather than
 * copied into this file: the question this guard asks is whether the user
 * agent is still painting whatever `--color-text` says *now*.
 */
const authoredText = (): Rgb => {
  const hex = cssColorToken('--color-text');
  expect(hex, '--color-text should be a six-digit hex').toMatch(
    /^#[0-9a-f]{6}$/,
  );
  return {
    r: parseInt(hex.slice(1, 3), 16),
    g: parseInt(hex.slice(3, 5), 16),
    b: parseInt(hex.slice(5, 7), 16),
  };
};

/** `rgb(229, 226, 225)` or `rgba(...)`, as numbers. */
const parseRgb = (value: string): Rgb | null => {
  const match = /rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/.exec(value);
  return match
    ? {
        r: Math.round(Number(match[1])),
        g: Math.round(Number(match[2])),
        b: Math.round(Number(match[3])),
      }
    : null;
};

/** Controls that carry no user-agent affordance of their own in this mode. */
const NON_LINK_CONTROLS =
  'button, input, select, textarea, summary, [tabindex]:not([tabindex="-1"]):not(a)';

/**
 * Assert the emulation is on, in both halves. Every test calls this first.
 *
 * The media query matching is not the same as the colours being forced. Only
 * the first half used to be asserted, and an engine that satisfies it while
 * painting the author's own palette passes every test in this file against the
 * ordinary rendering.
 *
 * So the second half is asserted too, against the token rather than against a
 * hex typed here. Under forced colours the user agent substitutes its own
 * palette, so body text is a system colour and cannot be the value this
 * stylesheet asked for.
 */
const forceColours = async (page: Page, route: string): Promise<void> => {
  await page.emulateMedia({ forcedColors: 'active' });

  const state = await page.evaluate(() => ({
    matches: matchMedia('(forced-colors: active)').matches,
    body: getComputedStyle(document.body).color,
  }));

  expect(
    state.matches,
    `forced-colors is not active on ${route}, so nothing below is being ` +
      `tested. Do not switch this file to test.use({ forcedColors }): that ` +
      `form silently does nothing here, which is why this check exists.`,
  ).toBe(true);

  const painted = parseRgb(state.body);
  expect(
    painted,
    `${route}: could not read a colour out of the computed body colour ` +
      `${JSON.stringify(state.body)}, so this guard cannot tell whether the ` +
      `palette was forced.`,
  ).not.toBeNull();

  expect(
    painted,
    `${route} matches (forced-colors: active), but the user agent is still ` +
      `painting the author's palette: <body> computes ${state.body}, which ` +
      `is --color-text in ${GLOBAL_CSS}. Under forced colours the user agent ` +
      `substitutes its own colours, so body text is a system colour and ` +
      `never the value this stylesheet asked for. Every assertion below ` +
      `would be measuring the ordinary rendering: the boundary check passes ` +
      `on author borders, and the link check passes or fails on author ` +
      `colours. Matching the media feature is not the same as the colours ` +
      `being forced, and this assertion is the whole difference.`,
  ).not.toEqual(authoredText());
};

type Unbounded = { tag: string; text: string; display: string };

const withoutABoundary = (page: Page): Promise<Unbounded[]> =>
  page.evaluate((selector) => {
    const transparent = (colour: string) =>
      colour === 'transparent' || /,\s*0\)$/.test(colour);

    const out: Unbounded[] = [];
    for (const element of document.querySelectorAll(selector)) {
      const style = getComputedStyle(element);

      /*
       * A control that is not painted cannot have missing edges. Without this
       * the contact form's honeypot is reported, which is a `display: none`
       * input nobody can see, reach or focus.
       *
       * Narrow on purpose: `display: none` only. `visibility: hidden` and
       * `opacity: 0` still occupy space and still take part in layout, and a
       * control hidden that way is one this file should keep reporting.
       */
      if (style.display === 'none') continue;

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

/**
 * The floor under the skip below, and the reason the skip cannot quietly
 * become universal.
 *
 * This runs on every engine, webkit included, because it asserts the split the
 * skip assumes rather than the skip itself: the engines that can force colours
 * still do, and webkit still cannot. A Playwright regression that broke the
 * emulation in chromium and firefox would fail here on both, rather than
 * leaving a file that is skipped on one engine and vacuous on the other two
 * while reporting green. WebKit gaining support fails here too, and says which
 * skip to delete.
 *
 * It deliberately does not ask "did forced colours work somewhere", a question
 * an engine nobody is looking at can answer. This asks it of each engine by
 * name.
 */
test('every engine that can force colours still does, and webkit still cannot', async ({
  page,
  browserName,
}) => {
  await gotoSettled(page, '/');
  await page.emulateMedia({ forcedColors: 'active' });

  const state = await page.evaluate(() => ({
    matches: matchMedia('(forced-colors: active)').matches,
    body: getComputedStyle(document.body).color,
  }));

  expect(
    state.matches,
    `${browserName} does not report (forced-colors: active) as matching at ` +
      `all, so the emulation is not reaching the page. Nothing in this file ` +
      `means anything until that is fixed.`,
  ).toBe(true);

  const painted = parseRgb(state.body);
  expect(
    painted,
    `${browserName}: could not read a colour out of ${JSON.stringify(state.body)}.`,
  ).not.toBeNull();

  if (browserName === 'webkit') {
    expect(
      painted,
      `webkit has started forcing colours: <body> computes ${state.body} ` +
        `rather than the author's --color-text. That is good news, and it ` +
        `makes the skip in this file wrong. Delete the test.skip in the ` +
        `"forced colours" block, run the suite there, and rewrite the note ` +
        `above it with what webkit now reports.`,
    ).toEqual(authoredText());
    return;
  }

  expect(
    painted,
    `${browserName} has stopped forcing colours: <body> computes ` +
      `${state.body}, which is --color-text in ${GLOBAL_CSS}. The block ` +
      `below is skipped on webkit, so if this engine stops forcing as well ` +
      `there is nothing left anywhere actually exercising forced colours, ` +
      `and this file would report green having asked nothing. Fix the ` +
      `emulation, or the Playwright pin, before trusting it again.`,
  ).not.toEqual(authoredText());
});

test.describe('forced colours', () => {
  /*
   * Skipped on webkit: a browser capability gap, not a defect in the site or
   * in this file.
   *
   * Measured 2026-09-09 with emulateMedia({ forcedColors: 'active' }) on `/`,
   * all three engines, Playwright 1.62.1:
   *
   *   chromium  body rgb(0, 0, 0)        ground rgb(255, 255, 255)  link rgb(0, 0, 159)
   *   firefox   body rgb(251, 251, 254)  ground rgb(28, 27, 34)     link rgb(0, 202, 219)
   *   webkit    body rgb(229, 226, 225)  which is --color-text
   *
   * Chromium substitutes a light system scheme and firefox a dark one, which
   * is the point: both hand back colours the author never wrote. WebKit hands
   * back `--color-text` from src/styles/global.css. It reports
   * (forced-colors: active) as matching and then paints the author's palette
   * anyway, so every test in this block would run against the ordinary
   * rendering. That is not a weaker version of the check, it is a different
   * check wearing its name, and it is what the guard in forceColours catches.
   *
   * Forced colours is the CSS surface of Windows High Contrast. WebKit ships
   * on no platform that has it, so there is nothing there for these tests to
   * find. Skipping is the honest answer; loosening the guard until webkit
   * passes would put the vacuum back.
   *
   * What would make this skip wrong: WebKit shipping forced-colors support, or
   * Playwright's emulation beginning to force the palette there. The test
   * above fails on the day either happens and names this skip in its message.
   *
   * The skip is by engine name and never by capability. Written as "skip when
   * the colours are not forced", a Playwright regression in chromium or
   * firefox would turn into a silent skip rather than a failure, and the whole
   * file would go green having run nothing. Naming the engine keeps every
   * other engine loud.
   */
  test.skip(
    ({ browserName }) => browserName === 'webkit',
    'webkit reports forced-colors as active but paints the author palette; see the note above',
  );

  for (const route of ROUTES) {
    test(`${route} holds up in forced colours`, async ({ page }) => {
      await gotoSettled(page, route);
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
        /*
         * A link inside <main>, and the selector is deliberately not a list.
         * `querySelector('main a[href], a[href]')` reads as "a content link,
         * or any link if there is none" and is not that: a selector list
         * resolves in document order, so the second half always wins and it
         * measures the skip link or the header wordmark. The exemption being
         * defended covers prose links in the page body, so the page body is
         * what has to be measured.
         */
        const link = document.querySelector('main a[href]');
        return {
          body: getComputedStyle(document.body).color,
          link: link ? getComputedStyle(link).color : null,
          /*
           * innerText rather than textContent. The contact cards put their
           * label, address and arrow in separate elements with no whitespace
           * between them once the HTML is minified, so textContent returned
           * "Emaillol@sinduri.lol→" and a failure message read as gibberish.
           * innerText is the rendered text, which puts the breaks back.
           */
          text: link
            ? ((link as HTMLElement).innerText || link.textContent || '')
                .replace(/\s+/g, ' ')
                .trim()
                .slice(0, 60)
            : null,
        };
      });

      expect(
        colours.link,
        `${route} has no link inside <main>, so there is no content link to ` +
          `measure and the check below would pass on nothing. Every route ` +
          `this site builds carries at least twelve.`,
      ).not.toBeNull();

      expect(
        colours.link,
        `${route} paints ${JSON.stringify(colours.text)} in <main> the same ` +
          `colour as body text in forced colours (${colours.body}). Links ` +
          `are exempt from needing a border ` +
          `here precisely because the user agent distinguishes them; if that ` +
          `stops being true the exemption stops being sound.`,
      ).not.toBe(colours.body);
    });
  }

  test('the focus indicator survives forced colours', async ({ page }) => {
    await gotoSettled(page, '/');
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
    await gotoSettled(page, '/');
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
