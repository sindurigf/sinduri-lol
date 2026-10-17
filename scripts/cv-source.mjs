import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

/** What the CV PDF is printed from; its SHA-256 is stored in the PDF as /CvSHA256. */
export const CV_HTML = 'cv/cv.html';
export const CV_SOURCES = [CV_HTML, 'cv/cv.css', 'cv/portrait.jpg'];

export const cvDigest = () =>
  CV_SOURCES.reduce(
    (hash, file) => hash.update(readFileSync(file)),
    createHash('sha256'),
  ).digest('hex');
