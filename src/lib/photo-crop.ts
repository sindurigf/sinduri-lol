import type { ImageMetadata } from 'astro';
import { getImage } from 'astro:assets';
import { WIDTHS } from './image-densities';

/** `--aspect-photo` in src/styles/global.css: the cover's frame on a post and on the feature card. */
export const PHOTO_RATIO = 4 / 3;

/**
 * The largest `ratio` crop of `image`, for `<Picture fit="cover">`: the build
 * crops each width, so the file keeps its full frame and no hidden pixels ship.
 */
export const cropTo = async (image: ImageMetadata, ratio: number) => {
  /* Via getImage, not `image.width`: reading the Proxy ships the original (check:untransformed). */
  const { options } = await getImage({ src: image });
  if (options.width === undefined || options.height === undefined) {
    throw new Error(`cropTo: no size for ${image.src}.`);
  }
  const width = Math.min(options.width, Math.floor(options.height * ratio));
  return {
    width,
    height: Math.round(width / ratio),
    widths: [...new Set([...WIDTHS.filter((w) => w < width), width])],
  };
};
