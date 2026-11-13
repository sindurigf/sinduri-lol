import { readFileSync } from 'node:fs';
import { expect, test } from './test';
import { gotoSettled } from './settle';
import { timedScan } from './axe';
import { RIDDLE } from '../src/lib/riddle';
import { DESKTOP_VIEWPORT, REFLOW_VIEWPORT } from './wcag';

const SENT_PATH = '/contact/sent/';

test.describe("The Hatter's riddle on the message sent page", () => {
  for (const viewport of [DESKTOP_VIEWPORT, REFLOW_VIEWPORT]) {
    test(`it is a closed native disclosure, opens from the keyboard and has no axe violations at ${viewport.width}px (SC 4.1.2, 2.1.1)`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      await gotoSettled(page, SENT_PATH);
      const summary = page.locator('summary', { hasText: RIDDLE.question });
      const details = page.locator('details', { has: summary });
      await expect(details).not.toHaveAttribute('open', '');
      await expect(page.getByText(RIDDLE.answer)).toBeHidden();
      await summary.focus();
      await page.keyboard.press('Enter');
      await expect(details).toHaveAttribute('open', '');
      await expect(page.getByText(RIDDLE.answer)).toBeVisible();
      await expect(page.getByText(RIDDLE.note)).toBeVisible();
      const box = await summary.boundingBox();
      expect(box!.height).toBeGreaterThanOrEqual(44);
      const results = await timedScan(page, 'riddle open');
      expect(
        results.violations.map((v) => `${v.id}: ${v.nodes[0]?.target}`),
      ).toEqual([]);
    });
  }

  for (const scheme of ['dark', 'light'] as const) {
    test(`its label is underlined under the pointer and its marker is not, ${scheme} (SC 1.4.1)`, async ({
      page,
    }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await page.setViewportSize(DESKTOP_VIEWPORT);
      await gotoSettled(page, SENT_PATH);
      const summary = page.locator('summary', { hasText: RIDDLE.question });
      const label = summary.getByText(RIDDLE.question);
      const marker = summary.locator('.post-contents-marker');
      const underlined = (part: typeof label) =>
        part.evaluate((el) =>
          getComputedStyle(el).textDecorationLine.includes('underline'),
        );
      expect(
        await underlined(label),
        'the label is underlined at rest, so hover adds nothing to it',
      ).toBe(false);
      await summary.hover();
      expect(
        await underlined(label),
        'the hovered label differs from rest by color alone',
      ).toBe(true);
      for (const part of [summary, marker]) {
        expect(
          await underlined(part),
          'the underline reaches the plus marker, which then reads as a plus-minus sign',
        ).toBe(false);
      }
    });
  }

  test('it works without a script', async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto(SENT_PATH);
    await page.locator('summary', { hasText: RIDDLE.question }).click();
    await expect(page.getByText(RIDDLE.answer)).toBeVisible();
    await context.close();
  });

  test('/credits names the source of the answer, and the page spells it as printed', async ({
    page,
  }) => {
    expect(RIDDLE.answer).toContain('nevar');
    expect(RIDDLE.note).toContain('never');
    await gotoSettled(page, '/credits/');
    await expect(page.locator('#alice')).toContainText('1896');
    expect(readFileSync('src/pages/contact/sent.astro', 'utf8')).toContain(
      'RIDDLE.answer',
    );
  });
});
