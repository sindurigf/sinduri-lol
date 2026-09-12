import { defineConfig } from '@playwright/test';

/*
 * The one spec that needs the Worker: tests/contact.spec.ts, which POSTs to the
 * contact endpoint and reads the rows it stores.
 *
 * It cannot run under playwright.config.ts. That suite is served by
 * scripts/preview-static.mjs, deliberately header-free and static, which has no
 * endpoint to post to. This config serves the build through `astro preview`
 * instead, which runs the Worker with local D1 and rate limiting bindings.
 *
 * Nothing here launches a browser: every test is an HTTP request, so it needs no
 * Playwright browser installed and runs in one project.
 *
 * The table is created before preview starts. Local D1 state is empty on a fresh
 * checkout and in CI, and without the table every valid submission fails as a
 * storage error. `IF NOT EXISTS` makes it safe to repeat on a local machine that
 * already has it.
 */

const PORT = 4322;
const BASE_URL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: './tests',
  testMatch: 'contact.spec.ts',
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? [['github'], ['list']] : [['list']],

  use: {
    baseURL: BASE_URL,
  },

  projects: [{ name: 'worker' }],

  webServer: {
    command:
      'npm run build' +
      ' && npx wrangler d1 execute sinduri-lol --local --file migrations/0001_create_messages.sql' +
      ` && npm run preview -- --port ${PORT} --ignore-lock`,
    url: BASE_URL,

    /*
     * `astro preview` forks itself into the background when it detects an AI
     * coding agent, so Playwright sees the foreground process exit and reports
     * the server as having failed to start. This marker is the one Astro's
     * launcher sets on the child it forks; setting it here keeps the CLI in the
     * foreground. `--ignore-lock` goes with it, or a leftover lock file fails
     * the run.
     */
    env: { ASTRO_PREVIEW_BACKGROUND: '1' },

    reuseExistingServer: false,
    timeout: 120_000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
});
