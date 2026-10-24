/*
 * Renders the rabbit atlas (src/assets/hero-rabbit.svg) at the atlas's size for
 * Let It Fall's climb: drawn at four times its size, then scaled down, so curved edges are smooth.
 */
import sharp, { type Sharp } from 'sharp';
import { ATLAS_SIZE } from './hero-field-rabbit.ts';

export const CLIMB_ATLAS_SOURCE = 'src/assets/hero-rabbit.svg';
export const CLIMB_ATLAS_TARGET = 'src/assets/hero-rabbit-climb.webp';
const SVG_DPI = 72;
const SUPERSAMPLE = 4;

export const renderClimbAtlas = (): Sharp =>
  sharp(CLIMB_ATLAS_SOURCE, { density: SVG_DPI * SUPERSAMPLE }).resize(
    ATLAS_SIZE.w,
    ATLAS_SIZE.h,
    { kernel: 'lanczos3' },
  );
