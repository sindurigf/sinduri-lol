import { defineConfig, devices } from '@playwright/test';

/* Manual, post-deploy only: CI runs before the deploy it would check. */
process.env.LIVE_ORIGIN ??= 'https://sinduri.lol';

export default defineConfig({
  testDir: './tests',
  testMatch: 'console.spec.ts',
  reporter: [['list']],
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
