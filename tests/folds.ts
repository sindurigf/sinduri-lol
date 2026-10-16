import type { Page } from './test';

/*
 * /brand keeps each section's full content in a closed <details> under its
 * spread. Opens them by clicking their summaries, so it works without
 * JavaScript too.
 */
export const openFolds = async (page: Page): Promise<void> => {
  const closed = page.locator('main .spread ~ details:not([open]) > summary');
  while ((await closed.count()) > 0) await closed.first().click();
};
