#!/usr/bin/env node
/*
 * Prints cv/cv.html to public/sinduri-guntupalli-cv.pdf, tagged for PDF/UA-1.
 * Usage: npm run publish:cv; check:pdf judges PDF/UA.
 */

import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from '@playwright/test';
import { CV_HTML, cvDigest } from './cv-source.mjs';
import { pdfPageCount } from './pdf-pages.mjs';

const TARGET = 'public/sinduri-guntupalli-cv.pdf';
const TMP_DIR = 'tmp';
const PAGES = 1;
const SECTIONS = 6;
const BYTES_PER_KB = 1024;

const fail = (message) => {
  console.error(`publish:cv: ${message}`);
  process.exit(1);
};

const raw = join(TMP_DIR, 'cv.raw.pdf');
const pageFile = join(TMP_DIR, 'cv.page.json');
const out = join(TMP_DIR, 'cv.pdf');
mkdirSync(TMP_DIR, { recursive: true });

const browser = await chromium.launch();
let seen;
try {
  const page = await browser.newPage();
  await page.goto(pathToFileURL(resolve(CV_HTML)).href);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForFunction(() =>
    [...document.images].every((img) => img.complete && img.naturalWidth > 0),
  );
  /* A wider font or a longer line pushes content past the page, which hides it. */
  const overflow = await page.evaluate(() => {
    const cv = document.querySelector('.cv');
    return cv.scrollHeight - cv.clientHeight;
  });
  if (overflow > 0)
    fail(`the CV is ${overflow}px taller than one page; shorten it.`);
  seen = await page.evaluate(() => ({
    title: document.title,
    links: [...document.querySelectorAll('a[href]')].map((a) => [
      a.href,
      a.textContent.replace(/\s+/g, ' ').trim(),
    ]),
    hidden: [...document.querySelectorAll('[aria-hidden="true"]')].filter(
      (el) => el.textContent.trim() !== '',
    ).length,
    headings: [...document.querySelectorAll('h1, h2, h3, h4, h5, h6')].map(
      (h) => h.textContent.replace(/\s+/g, ' ').trim(),
    ),
  }));
  writeFileSync(
    pageFile,
    JSON.stringify({ ...seen, digest: cvDigest(), digestKey: 'CvSHA256' }),
  );
  await page.pdf({
    path: raw,
    preferCSSPageSize: true,
    printBackground: true,
    tagged: true,
    outline: true,
  });
} finally {
  await browser.close();
}

const tagged = spawnSync(
  'python3',
  ['scripts/tag-pdf.py', raw, out, pageFile, seen.title],
  { stdio: 'inherit' },
);
if (tagged.status !== 0) fail('scripts/tag-pdf.py did not finish the tags.');

const bytes = readFileSync(out, 'latin1');
const pages = pdfPageCount(bytes);
const count = (tag) =>
  bytes.match(new RegExp(`/S\\s*/${tag}\\b`, 'g'))?.length ?? 0;
const problems = [
  pages !== PAGES && `${pages} pages, not ${PAGES}`,
  !/\/StructTreeRoot/.test(bytes) && 'no structure tree',
  !/\/Lang\s*\(en/.test(bytes) && 'no English /Lang',
  count('H1') !== 1 && `${count('H1')} H1s, not 1`,
  count('H2') !== SECTIONS && `${count('H2')} H2s, not ${SECTIONS}`,
  count('Figure') !== 0 && 'a tagged image; the portrait is decorative',
].filter(Boolean);
if (problems.length) fail(`${out}: ${problems.join('; ')}.`);

renameSync(out, TARGET);
console.log(
  `publish:cv: ${TARGET}, ${Math.round(bytes.length / BYTES_PER_KB)} KB. ` +
    'Run npm run check:pdf and read it in a PDF reader before committing.',
);
