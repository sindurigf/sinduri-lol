#!/usr/bin/env node
/*
 * Renders the sharing images in Chromium with Lexend and the site tokens:
 * public/images/og-default.png, the name card, and one card per built page
 * (src/lib/og-cards.ts): the page title on gold, the page's first photo or
 * the logo tile on a `background` strip. Run after `npm run build`.
 *
 *   npm run build && npm run og
 */

import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { chromium } from '@playwright/test';
import { cssColorToken } from '../src/lib/css-token.ts';
import {
  OG_CARD_DIR,
  OG_CARD_MANIFEST,
  OG_PHOTO_CHOICES,
  SITE_CARD_ROUTES,
  decodeEntities,
  firstPhoto,
  ogCardPath,
} from '../src/lib/og-cards.ts';
import { PERSON_NAME } from '../src/lib/profiles.ts';
import { SITE_NAME } from '../src/lib/site.ts';

const SITE_CARD = 'public/images/og-default.png';
const DIST = 'dist/client';
const FONT =
  'node_modules/@fontsource-variable/lexend/files/lexend-latin-wght-normal.woff2';
const MARK = 'src/assets/bunny-dark.png';
const JPEG_QUALITY = 85;

/* The 1.91:1 large-card crop; src/lib/og-image.ts declares the same size. */
const WIDTH = 1200;
const HEIGHT = 630;
const TAGLINE = ['Open source enthusiast', 'Positivity advocate'];
/** A page title shrinks from this size until it fits the gold panel in three lines. */
const TITLE_SIZE = { max: 96, min: 48, step: 2, maxHeight: 260 };

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
/*
 * Two places a whole photo fits clear of the stickers: tall beside them, or
 * wide between them. A photo takes whichever shows it larger.
 */
const PHOTO_BOXES = [
  { left: STRIP_LEFT + 130, top: 60, width: 310, height: 500 },
  { left: STRIP_LEFT + 40, top: 150, width: 400, height: 330 },
];
const PHOTO_EDGE = 4;
const PHOTO_SHADOW = 10;

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

const MIME = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  avif: 'image/avif',
};
const mimeOf = (path) => MIME[path.split('.').at(-1).toLowerCase()];

const tileMarkup = () =>
  `<div class="tile"><img alt="" src="${dataUri(MARK, 'image/png')}"></div>`;
const photoMarkup = (path) =>
  `<div class="photo"><img alt="" src="${dataUri(path, mimeOf(path))}"></div>`;

const page = (art) => `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face{font-family:'Lexend Variable';src:url(${dataUri(FONT, 'font/woff2')}) format('woff2');font-weight:100 900}
html,body{margin:0}
.og{position:relative;width:${WIDTH}px;height:${HEIGHT}px;overflow:hidden;background:${TOKENS.gold};font-family:'Lexend Variable';color:${TOKENS.goldText}}
.strip{position:absolute;inset:0 0 0 ${STRIP_LEFT}px;background:${TOKENS.background}}
.text{position:absolute;left:80px;top:0;bottom:62px;width:${STRIP_LEFT - 110}px;display:flex;flex-direction:column}
.name{margin-top:150px;font-size:80px;font-weight:900;line-height:.94;text-transform:uppercase;letter-spacing:.01em}
.eyebrow{margin-top:120px;font-size:26px;font-weight:900;letter-spacing:.12em;text-transform:uppercase}
.title{margin-top:24px;font-weight:900;line-height:.98;text-transform:uppercase;letter-spacing:.01em}
.tag{margin-top:40px;font-size:30px;line-height:1.35}
.domain{margin-top:auto;font-size:24px;font-weight:900;letter-spacing:.12em;text-transform:uppercase}
.tile{position:absolute;left:${TILE_LEFT}px;top:${TILE_TOP}px;box-sizing:border-box;width:${TILE.size}px;height:${TILE.size}px;display:grid;place-items:center;background:${TOKENS.gold};border:${TILE.edge}px solid ${TOKENS.fillEdge};border-radius:${TILE.radius}px;box-shadow:${TILE.shadow}px ${TILE.shadow}px 0 ${TOKENS.bunny};rotate:5deg}
.tile img{height:${TILE.mark}px}
.photo{position:absolute;display:flex;align-items:center;justify-content:center}
.photo img{box-sizing:border-box;border:${PHOTO_EDGE}px solid ${TOKENS.fillEdge};box-shadow:${PHOTO_SHADOW}px ${PHOTO_SHADOW}px 0 ${TOKENS.pink};rotate:2deg}
.sticker{position:absolute;padding:14px 28px;background:${TOKENS.background};font-size:44px;font-weight:900;letter-spacing:.06em;text-transform:uppercase;box-shadow:10px 10px 0 ${TOKENS.pink};rotate:-3deg}
.lepus{left:${STRIP_LEFT - 120}px;top:40px;color:${TOKENS.gold}}
.ridet{left:${STRIP_LEFT - 158}px;top:500px;color:${TOKENS.pinkText}}
</style></head><body><div class="og">
<div class="strip"></div>
${art}
<div class="sticker lepus">Lepus</div>
<div class="sticker ridet">Ridet</div>
<div class="text"><div class="name"></div><div class="eyebrow"></div><div class="title"></div><div class="tag"></div><div class="domain"></div></div>
</div></body></html>`;

/* textContent, not markup: page titles never become HTML. */
const fill = (tab, copy) =>
  tab.evaluate(
    async ({ copy, size, boxes, edge }) => {
      await document.fonts.ready;
      await Promise.all([...document.images].map((image) => image.decode()));
      const lines = (selector, parts) => {
        const element = document.querySelector(selector);
        parts.forEach((part, i) => {
          if (i > 0) element.append(document.createElement('br'));
          element.append(part);
        });
        return element;
      };
      for (const [selector, parts] of Object.entries(copy.lines)) {
        lines(selector, parts);
      }
      for (const selector of ['.name', '.eyebrow', '.title', '.tag']) {
        const element = document.querySelector(selector);
        if (!element.textContent) element.remove();
      }
      document.querySelector('.domain').textContent = copy.domain;

      const photo = document.querySelector('.photo');
      if (photo) {
        const image = photo.querySelector('img');
        const ratio = image.naturalWidth / image.naturalHeight;
        const best = boxes
          .map((box) => {
            const width = Math.min(box.width, box.height * ratio);
            return { box, width, height: width / ratio };
          })
          .sort((a, b) => b.width * b.height - a.width * a.height)[0];
        Object.assign(photo.style, {
          left: `${best.box.left}px`,
          top: `${best.box.top}px`,
          width: `${best.box.width}px`,
          height: `${best.box.height}px`,
        });
        image.style.width = `${best.width - edge}px`;
        image.style.height = `${best.height - edge}px`;
      }

      const title = document.querySelector('.title');
      if (title) {
        let px = size.max;
        title.style.fontSize = `${px}px`;
        while (
          (title.scrollWidth > title.clientWidth ||
            title.getBoundingClientRect().height > size.maxHeight) &&
          px > size.min
        ) {
          px -= size.step;
          title.style.fontSize = `${px}px`;
        }
      }
      const fitted = document.querySelector('.title, .name');
      return (
        fitted.scrollWidth <= fitted.clientWidth &&
        fitted.getBoundingClientRect().height <= size.maxHeight
      );
    },
    { copy, size: TITLE_SIZE, boxes: PHOTO_BOXES, edge: PHOTO_EDGE },
  );

const builtRoutes = () => {
  const routes = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name === 'index.html') {
        const path = relative(DIST, dir).split(sep).join('/');
        routes.push({ route: path ? `/${path}` : '/', file: full });
      }
    }
  };
  walk(DIST);
  return routes.sort((a, b) => a.route.localeCompare(b.route));
};

const metaContent = (html, property) =>
  new RegExp(`<meta property="${property}" content="([^"]*)"`).exec(
    html,
  )?.[1] ?? null;

/** The page's card: its title, and its photo by the owner's pick or the first in `<main>`. */
const cardFor = (route, html) => {
  const title = metaContent(html, 'og:title');
  if (!title) throw new Error(`make-og: ${route} has no og:title.`);
  if (Object.hasOwn(OG_PHOTO_CHOICES, route)) {
    const chosen = OG_PHOTO_CHOICES[route];
    return {
      title: decodeEntities(title),
      photo: chosen,
      file: chosen,
      photoAlt: null,
    };
  }
  const found = firstPhoto(html);
  return {
    title: decodeEntities(title),
    photo: found?.src ?? null,
    file: found ? join(DIST, found.src) : null,
    photoAlt: found?.alt ?? null,
  };
};

const altFor = ({ title, photo, photoAlt }) =>
  photo === null
    ? `${title}, ${SITE_NAME}, beside the ${SITE_NAME} bunny logo.`
    : `${title}, ${SITE_NAME}${photoAlt ? `, beside a photo: ${photoAlt}` : `, beside a photo of ${PERSON_NAME}.`}`;

const browser = await chromium.launch();
try {
  const tab = await browser.newPage({
    viewport: { width: WIDTH, height: HEIGHT },
  });

  await tab.setContent(page(tileMarkup()));
  if (
    !(await fill(tab, {
      lines: { '.name': PERSON_NAME.split(' '), '.tag': TAGLINE },
      domain: SITE_NAME,
    }))
  ) {
    throw new Error('make-og: the name runs past the gold panel; shorten it.');
  }
  await tab.screenshot({ path: SITE_CARD });
  console.log(`make-og: ${SITE_CARD}`);

  mkdirSync(join('public', OG_CARD_DIR), { recursive: true });
  const manifest = {};
  for (const { route, file } of builtRoutes()) {
    if (SITE_CARD_ROUTES.includes(route)) continue;
    const card = cardFor(route, readFileSync(file, 'utf8'));
    await tab.setContent(
      page(card.file ? photoMarkup(card.file) : tileMarkup()),
    );
    if (
      !(await fill(tab, {
        lines: { '.eyebrow': [PERSON_NAME], '.title': [card.title] },
        domain: SITE_NAME,
      }))
    ) {
      throw new Error(
        `make-og: ${route}'s title "${card.title}" does not fit in three lines even at ${TITLE_SIZE.min}px; shorten it.`,
      );
    }
    const out = join('public', ogCardPath(route));
    await tab.screenshot({ path: out, type: 'jpeg', quality: JPEG_QUALITY });
    manifest[route] = {
      title: card.title,
      photo: card.photo,
      alt: altFor(card),
    };
    console.log(`make-og: ${out}`);
  }
  writeFileSync(
    join('public', OG_CARD_MANIFEST),
    `${JSON.stringify(manifest, null, 2)}\n`,
  );
} finally {
  await browser.close();
}
