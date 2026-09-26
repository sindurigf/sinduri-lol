import { SITE_LANGUAGE } from './site-language';

/*
 * UTC: `z.coerce.date()` gives midnight UTC, which a local zone west of
 * Greenwich formats as the day before. Must not import `astro:content`.
 */

const POST_DATE_FORMAT: Intl.DateTimeFormatOptions = {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
  timeZone: 'UTC',
};

const ISO_DAY_LENGTH = 10;

/** "13 September 2026". */
export const formatPostDate = (date: Date): string =>
  date.toLocaleDateString(SITE_LANGUAGE, POST_DATE_FORMAT);

/** "YYYY-MM-DD". */
export const isoDate = (date: Date): string =>
  date.toISOString().slice(0, ISO_DAY_LENGTH);

/** Midnight UTC with its zone, "YYYY-MM-DDT00:00:00Z": Google otherwise assumes Googlebot's. */
export const isoDateTime = (date: Date): string => `${isoDate(date)}T00:00:00Z`;
