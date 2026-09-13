/**
 * Parsing an HTTP `Range` request header against a file of known size.
 *
 * Only a single `bytes` range is honoured. RFC 9110 lets a server ignore a
 * Range it does not want to serve, answering 200 with the whole file, and a
 * multi-range request would need a multipart/byteranges body that no browser
 * needs for video. Anything malformed is ignored the same way rather than
 * refused, because a 416 there would break playback over a header quirk.
 */

export interface ByteRange {
  start: number;
  /** Inclusive, as in `Content-Range`. */
  end: number;
}

/** Serve the whole file: no Range, or one this parser chooses to ignore. */
export const WHOLE_FILE = 'whole-file';

/** The range starts past the end of the file: 416. */
export const UNSATISFIABLE = 'unsatisfiable';

export type RangeResult = ByteRange | typeof WHOLE_FILE | typeof UNSATISFIABLE;

const SINGLE_BYTE_RANGE = /^bytes=(\d*)-(\d*)$/;

export const parseRange = (
  header: string | null,
  size: number,
): RangeResult => {
  if (header === null || size <= 0) return WHOLE_FILE;

  const match = SINGLE_BYTE_RANGE.exec(header.trim());
  if (match === null) return WHOLE_FILE;

  const [, first = '', last = ''] = match;
  if (first === '' && last === '') return WHOLE_FILE;

  const lastByte = size - 1;

  /* `bytes=-500`: the final 500 bytes. */
  if (first === '') {
    const suffix = Number(last);
    if (suffix === 0) return UNSATISFIABLE;
    return { start: Math.max(0, size - suffix), end: lastByte };
  }

  const start = Number(first);
  if (start > lastByte) return UNSATISFIABLE;

  /* `bytes=500-`: from 500 to the end. */
  if (last === '') return { start, end: lastByte };

  const end = Number(last);
  if (end < start) return WHOLE_FILE;

  return { start, end: Math.min(end, lastByte) };
};

/** The `Content-Range` value for a satisfiable range. */
export const contentRange = ({ start, end }: ByteRange, size: number): string =>
  `bytes ${start}-${end}/${size}`;

/** The `Content-Range` value a 416 carries. */
export const unsatisfiedRange = (size: number): string => `bytes */${size}`;

/**
 * A stream of only the bytes in `range`, read from `source` without buffering
 * the file: the Worker's memory and CPU limits stay flat however large the
 * video is. The source is cancelled once the range is complete.
 */
export const sliceStream = (
  source: ReadableStream<Uint8Array>,
  { start, end }: ByteRange,
): ReadableStream<Uint8Array> => {
  const reader = source.getReader();
  let position = 0;

  return new ReadableStream<Uint8Array>({
    /*
     * Reads until a chunk overlaps the range. Returning from `pull` without
     * enqueueing anything does not make the stream ask again, so skipping the
     * chunks before `start` has to happen inside one call.
     */
    async pull(controller) {
      for (;;) {
        const { done, value } = await reader.read();

        if (done) {
          controller.close();
          return;
        }

        const chunkStart = position;
        const chunkEnd = position + value.byteLength - 1;
        position += value.byteLength;

        const overlaps = chunkEnd >= start && chunkStart <= end;
        if (overlaps) {
          controller.enqueue(
            value.subarray(
              Math.max(0, start - chunkStart),
              Math.min(value.byteLength, end - chunkStart + 1),
            ),
          );
        }

        if (chunkEnd >= end) {
          controller.close();
          await reader.cancel();
          return;
        }

        if (overlaps) return;
      }
    },
    cancel(reason) {
      return reader.cancel(reason);
    },
  });
};
