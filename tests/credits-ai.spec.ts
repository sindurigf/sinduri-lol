import { expect, test } from './test';
import { gotoSettled } from './settle';
import { ENGINE_INVARIANT } from './tags';

test.describe('/credits Made with AI', () => {
  test(
    'lists every AI-made drawing with a link to where it is',
    ENGINE_INVARIANT,
    async ({ page }) => {
      await gotoSettled(page, '/credits/');
      const section = page.locator('#ai');
      await expect(
        section.getByRole('heading', { level: 2, name: 'Made with AI' }),
      ).toBeVisible();
      await expect(
        section.getByRole('link', {
          name: 'The hopping bunny on the homepage',
        }),
      ).toHaveAttribute('href', '/');
      await expect(
        section.getByRole('link', {
          name: 'The About cats and their control and trick icons',
        }),
      ).toHaveAttribute('href', '/about/');
      await expect(
        section.getByRole('link', {
          name: 'The sticker bunny in the footer and on the 404 page, and the jumping bunny in the logo, roundel, site icons and share images',
        }),
      ).toHaveAttribute('href', '/');
      await expect(
        section.getByRole('link', {
          name: 'The laughing bunny on the /about tile',
        }),
      ).toHaveAttribute('href', '/about/');
    },
  );

  test('links the AI disclosure', ENGINE_INVARIANT, async ({ page }) => {
    await gotoSettled(page, '/credits/');
    await expect(
      page.locator('#ai').getByRole('link', { name: 'AI disclosure' }),
    ).toHaveAttribute('href', /\/AI_DISCLOSURE\.md$/);
  });
});
