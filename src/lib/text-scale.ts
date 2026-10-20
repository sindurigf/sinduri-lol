/** The root text sizes the footer control steps through, as percent of the browser's own size. */
export const TEXT_SCALE_STEPS = [75, 100, 125, 150, 200] as const;

export const TEXT_SCALE_DEFAULT = 100;

/** Percent as a string; absent while the size is the default. */
export const TEXT_SCALE_KEY = 'text-scale';
