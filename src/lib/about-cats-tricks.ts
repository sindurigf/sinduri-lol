/*
 * Each cat's paw-button tricks, signature ones first (CAT_WEIGHTS key order); names and icons are in
 * about-cats-tricks.json.
 * about-cats.ts fetches the JSON on demand, so /about's script carries none of it, and checks it
 * with isTricksData.
 */
import { CAT_WEIGHTS, type MoveName } from './about-cats-moves';
import type { CatId } from './about-cats-types';

export type PlayMove = Exclude<MoveName, 'sleep' | 'wake'>;

interface Trick {
  label: string;
  /** A key of `icons`. */
  icon: string;
}

interface IconShape {
  d: string;
  /** Filled, with no outline. */
  solid?: boolean;
}

/** 24 by 24, drawn as strokes; see .cat-trick-icon in about-cats.css. */
export interface TricksData {
  tricks: Record<PlayMove | 'random', Trick>;
  icons: Record<string, IconShape[]>;
}

/** A cat's own moves, signature ones first. */
export const tricksOf = (id: CatId): PlayMove[] =>
  Object.keys(CAT_WEIGHTS[id]) as PlayMove[];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

/** Every name a list can show, each with a label and a drawn icon. */
export const isTricksData = (value: unknown): value is TricksData => {
  if (!isRecord(value) || !isRecord(value.tricks) || !isRecord(value.icons))
    return false;
  const { tricks, icons } = value;
  const names = ['random', ...Object.values(CAT_WEIGHTS).flatMap(Object.keys)];
  return names.every((name) => {
    const trick = tricks[name];
    if (!isRecord(trick) || typeof trick.label !== 'string') return false;
    return Array.isArray(icons[trick.icon as string]);
  });
};
