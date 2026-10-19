import { expect, test } from './test';
import { gotoSettled } from './settle';
import { ENGINE_INVARIANT } from './tags';

/* /about links #name and /404 links #not-found; Made with AI closes the page. */
const SECTIONS = [
  { heading: 'Where the Name Comes From', id: 'name' },
  { heading: 'Thank You' },
  { heading: 'Guides' },
  { heading: 'Photos' },
  { heading: 'Design Tools' },
  { heading: 'Built and Tested With' },
  { heading: 'The 404 Page', id: 'not-found' },
  { heading: 'Made with AI', id: 'ai' },
] as const;

test(
  '/credits reads people first and keeps its linked anchors on their sections',
  ENGINE_INVARIANT,
  async ({ page }) => {
    await gotoSettled(page, '/credits/');
    /* innerText skips the closed abbreviation popover; headings are uppercase. */
    const headings = await page.locator('main h2').allInnerTexts();
    expect(
      headings.map((text) => text.trim().toLowerCase()),
      'The section headings are out of order.',
    ).toEqual(SECTIONS.map((section) => section.heading.toLowerCase()));
    for (const section of SECTIONS) {
      if (!('id' in section)) continue;
      const heading = page
        .locator(`#${section.id}`)
        .getByRole('heading', { level: 2 });
      expect(
        (await heading.innerText()).trim().toLowerCase(),
        `#${section.id} is not the ${section.heading} section.`,
      ).toBe(section.heading.toLowerCase());
    }
  },
);
