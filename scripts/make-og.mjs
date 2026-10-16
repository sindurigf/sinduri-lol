#!/usr/bin/env node
/*
 * Renders public/images/og-default.png, the sharing image, in Chromium with
 * Lexend and the site tokens: the gold panel with the name and tagline, and
 * the logo tile on a `background` strip. Rerun after changing any of those.
 *
 *   npm run og
 */

import { readFileSync } from 'node:fs';
import { chromium } from '@playwright/test';
import { cssColorToken } from '../src/lib/css-token.ts';
import { PERSON_NAME } from '../src/lib/profiles.ts';
import { SITE_NAME } from '../src/lib/site.ts';

const OUT = 'public/images/og-default.png';
const FONT =
  'node_modules/@fontsource-variable/lexend/files/lexend-latin-wght-normal.woff2';
const MARK = 'src/assets/bunny-dark.png';

/* The 1.91:1 large-card crop; src/lib/og-image.ts declares the same size. */
const WIDTH = 1200;
const HEIGHT = 630;
const TAGLINE = ['Open source enthusiast', 'Positivity advocate'];

/* The header's 48px logo tile, scaled up: edge, radius, shadow and mark keep its proportions. */
const TILE_SCALE = 7;
const TILE = {
  size: 48 * TILE_SCALE,
  edge: 4 * TILE_SCALE,
  radius: 14 * TILE_SCALE,
  shadow: 8 * TILE_SCALE,
  mark: 24 * TILE_SCALE,
};
const STRIP_LEFT = 700;
/* Whole, centered on the strip with its shadow: link previews crop the edges. */
const TILE_LEFT =
  STRIP_LEFT + (WIDTH - STRIP_LEFT - TILE.size - TILE.shadow) / 2;
const TILE_TOP = (HEIGHT - TILE.size - TILE.shadow) / 2;

const TOKENS = {
  gold: cssColorToken('--color-gold'),
  goldText: cssColorToken('--color-gold-text'),
  background: cssColorToken('--color-background'),
  fillEdge: cssColorToken('--color-fill-edge'),
  bunny: cssColorToken('--color-bunny'),
  pink: cssColorToken('--color-pink'),
  pinkText: cssColorToken('--color-pink-text'),
};

const dataUri = (path, type) =>
  `data:${type};base64,${readFileSync(path).toString('base64')}`;

const page = () => `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face{font-family:'Lexend Variable';src:url(${dataUri(FONT, 'font/woff2')}) format('woff2');font-weight:100 900}
html,body{margin:0}
.og{position:relative;width:${WIDTH}px;height:${HEIGHT}px;overflow:hidden;background:${TOKENS.gold};font-family:'Lexend Variable';color:${TOKENS.goldText}}
.strip{position:absolute;inset:0 0 0 ${STRIP_LEFT}px;background:${TOKENS.background}}
.text{position:absolute;left:80px;top:0;bottom:62px;width:${STRIP_LEFT - 110}px;display:flex;flex-direction:column}
.name{margin-top:150px;font-size:80px;font-weight:900;line-height:.94;text-transform:uppercase;letter-spacing:.01em}
.tag{margin-top:40px;font-size:30px;line-height:1.35}
.domain{margin-top:auto;font-size:24px;font-weight:900;letter-spacing:.12em;text-transform:uppercase}
.tile{position:absolute;left:${TILE_LEFT}px;top:${TILE_TOP}px;box-sizing:border-box;width:${TILE.size}px;height:${TILE.size}px;display:grid;place-items:center;background:${TOKENS.gold};border:${TILE.edge}px solid ${TOKENS.fillEdge};border-radius:${TILE.radius}px;box-shadow:${TILE.shadow}px ${TILE.shadow}px 0 ${TOKENS.bunny};rotate:5deg}
.tile img{height:${TILE.mark}px}
.sticker{position:absolute;padding:14px 28px;background:${TOKENS.background};font-size:44px;font-weight:900;letter-spacing:.06em;text-transform:uppercase;box-shadow:10px 10px 0 ${TOKENS.pink};rotate:-3deg}
.lepus{left:${STRIP_LEFT - 120}px;top:40px;color:${TOKENS.gold}}
.ridet{left:${STRIP_LEFT - 158}px;top:500px;color:${TOKENS.pinkText}}
</style></head><body><div class="og">
<div class="strip"></div>
<div class="tile"><img alt="" src="${dataUri(MARK, 'image/png')}"></div>
<div class="sticker lepus">Lepus</div>
<div class="sticker ridet">Ridet</div>
<div class="text"><div class="name"></div><div class="tag"></div><div class="domain"></div></div>
</div></body></html>`;

const browser = await chromium.launch();
try {
  const tab = await browser.newPage({
    viewport: { width: WIDTH, height: HEIGHT },
  });
  await tab.setContent(page());
  await tab.evaluate(() => document.fonts.ready);
  /* textContent, not markup: the copy never becomes HTML. */
  const fits = await tab.evaluate(
    ({ name, tagline, domain }) => {
      const lines = (selector, parts) => {
        const element = document.querySelector(selector);
        parts.forEach((part, i) => {
          if (i > 0) element.append(document.createElement('br'));
          element.append(part);
        });
        return element;
      };
      const title = lines('.name', name.split(' '));
      lines('.tag', tagline);
      document.querySelector('.domain').textContent = domain;
      return title.scrollWidth <= title.clientWidth;
    },
    { name: PERSON_NAME, tagline: TAGLINE, domain: SITE_NAME },
  );
  if (!fits) {
    throw new Error('make-og: the name runs past the gold panel; shorten it.');
  }
  await tab.screenshot({ path: OUT });
  console.log(`make-og: ${OUT}`);
} finally {
  await browser.close();
}
