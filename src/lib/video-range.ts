import {
  UNSATISFIABLE,
  WHOLE_FILE,
  contentRange,
  parseRange,
  sliceStream,
  unsatisfiedRange,
} from './byte-range';

/*
 * Serves files under /videos/ with byte-range support.
 *
 * Workers static assets answer a `Range` request with the whole file and a
 * 200 (measured on production, 2026-09-13). Safari and iOS will not play a
 * video without a 206, so those files are routed through the Worker by
 * `run_worker_first` in wrangler.jsonc and sliced here. Every other asset is
 * still served by the asset layer directly.
 */

const VIDEO_PATH_PREFIX = '/videos/';

/*
 * Byte sizes by URL, recorded by astro.config.mjs at build time: the ASSETS
 * binding streams a file without a Content-Length.
 */
declare const __VIDEO_SIZES__: Readonly<Record<string, number>>;

/*
 * The Workers runtime's stream that declares its length up front, which is
 * what makes a streamed body carry Content-Length. Without it a 206 goes out
 * chunked, and Safari's media loader is strict about partial responses.
 */
declare const FixedLengthStream: new (length: number) => {
  readonly readable: ReadableStream<Uint8Array>;
  readonly writable: WritableStream<Uint8Array>;
};

const withLength = (
  body: ReadableStream<Uint8Array>,
  length: number,
): ReadableStream<Uint8Array> => {
  const { readable, writable } = new FixedLengthStream(length);
  body.pipeTo(writable).catch((error: unknown) => {
    console.error(
      'video range: stream failed:',
      error instanceof Error ? error.message : String(error),
    );
  });
  return readable;
};

/** The ASSETS binding, typed structurally like the bindings in contact-env. */
export interface AssetsBinding {
  fetch(request: Request): Promise<Response>;
}

const HTTP_PARTIAL_CONTENT = 206;
const HTTP_RANGE_NOT_SATISFIABLE = 416;
const READ_METHODS = new Set(['GET', 'HEAD']);

export const isVideoRequest = (request: Request): boolean =>
  new URL(request.url).pathname.startsWith(VIDEO_PATH_PREFIX);

/*
 * Only these request headers reach the asset layer. Dropping Range makes it
 * send the whole file for slicing; dropping Accept-Encoding keeps the body
 * the raw bytes the offsets count, never a compressed encoding of them.
 */
const assetRequest = (request: Request): Request => {
  const headers = new Headers();
  for (const name of ['If-None-Match', 'If-Modified-Since']) {
    const value = request.headers.get(name);
    if (value !== null) headers.set(name, value);
  }
  return new Request(request.url, { method: 'GET', headers });
};

/*
 * `If-Range` says: send the range only if the file is still the one I have.
 * A validator that no longer matches means the whole new file.
 */
const rangeStillValid = (request: Request, asset: Response): boolean => {
  const ifRange = request.headers.get('If-Range');
  if (ifRange === null) return true;
  return ifRange === asset.headers.get('ETag');
};

export const serveVideo = async (
  request: Request,
  assets: AssetsBinding,
): Promise<Response> => {
  if (!READ_METHODS.has(request.method)) return assets.fetch(request);

  const asset = await assets.fetch(assetRequest(request));
  const isHead = request.method === 'HEAD';

  const size = __VIDEO_SIZES__[new URL(request.url).pathname] ?? 0;
  if (!asset.ok || asset.body === null || size <= 0) return asset;

  const headers = new Headers(asset.headers);
  headers.set('Accept-Ranges', 'bytes');
  headers.set('Content-Length', String(size));

  const range = rangeStillValid(request, asset)
    ? parseRange(request.headers.get('Range'), size)
    : WHOLE_FILE;

  if (range === WHOLE_FILE) {
    if (isHead) await asset.body.cancel();
    return new Response(isHead ? null : withLength(asset.body, size), {
      status: asset.status,
      headers,
    });
  }

  if (range === UNSATISFIABLE) {
    await asset.body.cancel();
    headers.set('Content-Range', unsatisfiedRange(size));
    headers.delete('Content-Length');
    return new Response(null, { status: HTTP_RANGE_NOT_SATISFIABLE, headers });
  }

  const length = range.end - range.start + 1;
  headers.set('Content-Range', contentRange(range, size));
  headers.set('Content-Length', String(length));

  if (isHead) {
    await asset.body.cancel();
    return new Response(null, { status: HTTP_PARTIAL_CONTENT, headers });
  }

  return new Response(withLength(sliceStream(asset.body, range), length), {
    status: HTTP_PARTIAL_CONTENT,
    headers,
  });
};
