import { defineConfig, devices } from '@playwright/test';

/*
 * `npm run check:live:console`: tests/console.spec.ts against the deployed
 * site instead of the build. Run by hand after a deploy or a dashboard change,
 * never in CI, for the same reason as scripts/check-live.sh: CI runs before the
 * deploy, so nothing live corresponds to the change under test yet.
 *
 * Point it elsewhere with LIVE_ORIGIN, for example a preview deployment.
 */
process.env.LIVE_ORIGIN ??= 'https://sinduri.lol';

export default defineConfig({
  testDir: './tests',
  testMatch: 'console.spec.ts',
  reporter: [['list']],
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
