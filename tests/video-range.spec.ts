import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from './test';
import {
  UNSATISFIABLE,
  WHOLE_FILE,
  parseRange,
  sliceStream,
} from '../src/lib/byte-range';
import { serveVideo } from '../src/lib/video-range';

/*
 * Byte ranges on /videos/*, which Safari and iOS need before they will play a
 * video: they ask for a range and refuse anything but a 206.
 *
 * Runs under playwright.worker.config.ts, because the behaviour lives in the
 * Worker (src/lib/video-range.ts, routed by `run_worker_first`). The static
 * server the main suite uses answers a Range with the whole file, exactly as
 * Workers static assets do on production, so these assertions would fail
 * there; that is the defect this file guards.
 *
 * Proven able to fail, 2026-09-13: with sliceStream returning after one chunk
 * instead of reading past the chunks ahead of `start`, four tests here fail,
 * the in-memory ones included, because the fake file streams in 64-byte
 * pieces as the ASSETS binding does. That was the empty-body bug measured
 * under wrangler dev before the fix.
 */

const VIDEO_DIR = 'public/videos';
const SIZE = 5_000;

/*
 * The site ships no video today. The end-to-end half below needs a real file
 * to request, so it runs against the first video in public/videos/ and skips,
 * saying so, while there is none; the handler itself is covered either way by
 * the in-memory half.
 */
const videoOnDisk = existsSync(VIDEO_DIR)
  ? readdirSync(VIDEO_DIR).find((name) => /\.(mp4|webm)$/.test(name))
  : undefined;

const chunked = (
  bytes: Uint8Array,
  chunk: number,
): ReadableStream<Uint8Array> =>
  new ReadableStream({
    start(controller) {
      for (let at = 0; at < bytes.length; at += chunk) {
        controller.enqueue(bytes.subarray(at, at + chunk));
      }
      controller.close();
    },
  });

test.describe('parseRange', () => {
  test('reads a closed, an open and a suffix range', () => {
    expect(parseRange('bytes=0-99', SIZE)).toEqual({ start: 0, end: 99 });
    expect(parseRange('bytes=4900-', SIZE)).toEqual({ start: 4900, end: 4999 });
    expect(parseRange('bytes=-100', SIZE)).toEqual({ start: 4900, end: 4999 });
  });

  test('clamps an end past the file and a suffix longer than it', () => {
    expect(parseRange('bytes=10-999999', SIZE)).toEqual({
      start: 10,
      end: 4999,
    });
    expect(parseRange('bytes=-999999', SIZE)).toEqual({ start: 0, end: 4999 });
  });

  test('refuses a start past the end, and an empty suffix', () => {
    expect(parseRange(`bytes=${SIZE}-`, SIZE)).toBe(UNSATISFIABLE);
    expect(parseRange('bytes=-0', SIZE)).toBe(UNSATISFIABLE);
  });

  test('ignores what it does not serve rather than refusing it', () => {
    for (const header of [
      null,
      'bytes=0-1,5-6',
      'items=0-1',
      'bytes=-',
      'bytes=9-3',
      'nonsense',
    ]) {
      expect(parseRange(header, SIZE), String(header)).toBe(WHOLE_FILE);
    }
  });
});

test.describe('sliceStream', () => {
  const collect = async (
    stream: ReadableStream<Uint8Array>,
  ): Promise<number[]> => [
    ...new Uint8Array(await new Response(stream).arrayBuffer()),
  ];

  const source = Uint8Array.from({ length: 100 }, (_, index) => index);

  test('returns exactly the range, across chunk boundaries', async () => {
    const CHUNK = 7;
    for (const [start, end] of [
      [0, 0],
      [0, 99],
      [6, 7],
      [50, 63],
      [99, 99],
    ] as const) {
      expect(
        await collect(sliceStream(chunked(source, CHUNK), { start, end })),
        `${start}-${end}`,
      ).toEqual([...source.subarray(start, end + 1)]);
    }
  });
});

test.describe('serveVideo, against an in-memory file', () => {
  const FAKE_URL = 'https://sinduri.lol/videos/fake.mp4';
  const fake = Uint8Array.from({ length: SIZE }, (_, index) => index % 251);
  /* Streamed in pieces, as the ASSETS binding does, so offsets cross chunks. */
  const ASSET_CHUNK = 64;

  /*
   * The two runtime globals the handler relies on: the sizes astro.config.mjs
   * records, and the Workers FixedLengthStream, stood in for by a plain
   * pass-through, since Node has neither.
   */
  test.beforeAll(() => {
    Object.assign(globalThis, {
      __VIDEO_SIZES__: { '/videos/fake.mp4': SIZE },
      FixedLengthStream: class {
        readonly readable: ReadableStream<Uint8Array>;
        readonly writable: WritableStream<Uint8Array>;
        constructor() {
          ({ readable: this.readable, writable: this.writable } =
            new TransformStream<Uint8Array, Uint8Array>());
        }
      },
    });
  });

  const assets = {
    fetch: async (): Promise<Response> =>
      new Response(chunked(fake, ASSET_CHUNK), {
        headers: { 'Content-Type': 'video/mp4', ETag: '"fake"' },
      }),
  };

  const get = (headers: Record<string, string> = {}, method = 'GET') =>
    serveVideo(new Request(FAKE_URL, { method, headers }), assets);

  test('no Range is the whole file, advertising ranges', async () => {
    const response = await get();
    expect(response.status).toBe(200);
    expect(response.headers.get('Accept-Ranges')).toBe('bytes');
    expect(response.headers.get('Content-Length')).toBe(String(SIZE));
  });

  for (const [header, start, end] of [
    ['bytes=0-1', 0, 1],
    ['bytes=1000-1999', 1000, 1999],
    ['bytes=-500', SIZE - 500, SIZE - 1],
    [`bytes=${SIZE - 10}-`, SIZE - 10, SIZE - 1],
  ] as const) {
    test(`${header} is a 206 with those bytes`, async () => {
      const response = await get({ Range: header });
      expect(response.status).toBe(206);
      expect(response.headers.get('Content-Range')).toBe(
        `bytes ${start}-${end}/${SIZE}`,
      );
      expect(response.headers.get('Content-Length')).toBe(
        String(end - start + 1),
      );
      expect(new Uint8Array(await response.arrayBuffer())).toEqual(
        fake.subarray(start, end + 1),
      );
    });
  }

  test('past the end is a 416 naming the size', async () => {
    const response = await get({ Range: `bytes=${SIZE}-` });
    expect(response.status).toBe(416);
    expect(response.headers.get('Content-Range')).toBe(`bytes */${SIZE}`);
  });

  test('a stale If-Range, and a HEAD, behave', async () => {
    expect(
      (await get({ Range: 'bytes=0-1', 'If-Range': '"old"' })).status,
    ).toBe(200);
    const head = await get({ Range: 'bytes=0-9' }, 'HEAD');
    expect(head.status).toBe(206);
    expect(head.body).toBeNull();
  });
});

test.describe('the Worker serves /videos/* with byte ranges', () => {
  test.skip(
    videoOnDisk === undefined,
    'public/videos/ holds no video, so there is nothing to request',
  );

  const VIDEO_URL = `/videos/${videoOnDisk ?? ''}`;
  const file = videoOnDisk
    ? readFileSync(join(VIDEO_DIR, videoOnDisk))
    : Buffer.alloc(0);

  test('the build records every video at its size on disk', () => {
    /*
     * astro.config.mjs defines __VIDEO_SIZES__ from public/videos/; a Range
     * served against a stale size would cut a video short or 416 it.
     */
    const entry = readFileSync('dist/server/entry.mjs', 'utf8');
    const videos = readdirSync(VIDEO_DIR);
    expect(videos.length).toBeGreaterThan(0);

    for (const name of videos) {
      const recorded = new RegExp(
        `"/videos/${name.replaceAll('.', '\\.')}":\\s*(\\d+)`,
      ).exec(entry);
      expect(
        recorded?.[1],
        `${name} is not recorded in the Worker bundle`,
      ).toBe(String(statSync(join(VIDEO_DIR, name)).size));
    }
  });

  test('a request with no Range gets the whole file and advertises ranges', async ({
    request,
  }) => {
    const response = await request.get(VIDEO_URL);
    expect(response.status()).toBe(200);
    expect(response.headers()['accept-ranges']).toBe('bytes');
    expect(Number(response.headers()['content-length'])).toBe(file.length);
  });

  for (const [header, start, end] of [
    ['bytes=0-1', 0, 1],
    ['bytes=1000-1999', 1000, 1999],
    ['bytes=-500', file.length - 500, file.length - 1],
    [`bytes=${file.length - 10}-`, file.length - 10, file.length - 1],
  ] as const) {
    test(`${header} is a 206 with those bytes and their length`, async ({
      request,
    }) => {
      const response = await request.get(VIDEO_URL, {
        headers: { Range: header },
      });
      const headers = response.headers();

      expect(response.status()).toBe(206);
      expect(headers['content-range']).toBe(
        `bytes ${start}-${end}/${file.length}`,
      );
      expect(Number(headers['content-length'])).toBe(end - start + 1);
      expect(
        Buffer.compare(await response.body(), file.subarray(start, end + 1)),
      ).toBe(0);
    });
  }

  test('a range past the end is a 416 naming the size', async ({ request }) => {
    const response = await request.get(VIDEO_URL, {
      headers: { Range: `bytes=${file.length}-` },
    });
    expect(response.status()).toBe(416);
    expect(response.headers()['content-range']).toBe(`bytes */${file.length}`);
  });

  test('a stale If-Range gets the whole file', async ({ request }) => {
    const response = await request.get(VIDEO_URL, {
      headers: { Range: 'bytes=0-1', 'If-Range': '"not-this-file"' },
    });
    expect(response.status()).toBe(200);
  });

  test('a ranged response keeps the site headers from public/_headers', async ({
    request,
  }) => {
    const response = await request.get(VIDEO_URL, {
      headers: { Range: 'bytes=0-1' },
    });
    const headers = response.headers();
    expect(headers['x-content-type-options']).toBe('nosniff');
    expect(headers['content-security-policy']).toContain("default-src 'self'");
  });
});
