/*
 * The browser-UI colour, read out of the token that defines it.
 *
 * Two things need this value as a literal and neither can take a `var()`:
 * `<meta name="theme-color">` in BaseLayout.astro, which takes a CSS colour,
 * and `theme_color` / `background_color` in the web app manifest, which is
 * JSON and has no access to the cascade at all.
 *
 * Copying the hex into either would put a raw colour in src/ outside
 * global.css, which is what scripts/check-tokens.mjs exists to prevent, and
 * it would drift the first time the ground was retoned. The value is read
 * back out of the stylesheet at build time instead, here rather than in each
 * consumer.
 *
 * Vite resolves `?raw` at build time and none of this reaches the client.
 */
import globalCss from '../styles/global.css?raw';

const BACKGROUND_TOKEN = /--color-background:\s*(#[0-9a-fA-F]{3,8})\s*;/;

const match = BACKGROUND_TOKEN.exec(globalCss);

/*
 * Throwing is the point. A silent undefined renders
 * `<meta name="theme-color">` with no content and writes `null` into the
 * manifest, both of which browsers ignore, so the failure would show only as
 * the wrong colour behind a phone's address bar or on an installed app's
 * splash screen.
 */
if (!match) {
  throw new Error(
    'Could not read --color-background out of global.css. ' +
      'The token was renamed or reformatted; update BACKGROUND_TOKEN to match.',
  );
}

/** The value of `--color-background`, as a hex literal. */
export const themeColor: string = match[1]!;
