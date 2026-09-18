import { test as base } from '@playwright/test';
import { addCoverageReport } from 'monocart-reporter';

/*
 * Every spec imports `test` from here rather than from @playwright/test, so a
 * coverage run can collect what the browser executed without editing any spec.
 *
 * Outside a coverage run this is @playwright/test's own `test`, untouched: the
 * fixture below would otherwise create a page for every test, including the
 * hundreds that only read files from dist/. `npm run test:coverage` sets
 * COVERAGE=1; see playwright.coverage.config.ts.
 *
 * Chromium only, because V8 coverage is a Chromium DevTools feature.
 */
export {
  expect,
  type Page,
  type Locator,
  type Response,
} from '@playwright/test';

const coverage = base.extend<{ collectCoverage: void }>({
  collectCoverage: [
    async ({ page, browserName }, use, testInfo) => {
      if (browserName !== 'chromium') return use();
      await page.coverage.startJSCoverage({ resetOnNavigation: false });
      await use();
      const entries = await page.coverage.stopJSCoverage();
      // A test that closed its own page, or never navigated, has nothing to add.
      if (Array.isArray(entries) && entries.length > 0) {
        await addCoverageReport(entries, testInfo);
      }
    },
    { auto: true },
  ],
});

export const test = process.env.COVERAGE === '1' ? coverage : base;
