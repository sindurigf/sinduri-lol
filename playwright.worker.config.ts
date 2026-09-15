import { defineConfig } from '@playwright/test';

/*
 * The specs that need the Worker: tests/contact.spec.ts and
 * tests/comments.spec.ts, which POST to on-demand routes and read the rows they
 * store, and tests/video-range.spec.ts.
 *
 * It cannot run under playwright.config.ts. That suite is served by
 * scripts/preview-static.mjs, deliberately header-free and static, which has no
 * endpoint to post to. This config serves the build through `astro preview`
 * instead, which runs the Worker with local D1 and rate limiting bindings.
 *
 * Nothing here launches a browser: every test is an HTTP request or a local D1
 * query, so it needs no Playwright browser installed and runs in one project.
 *
 * The tables are created before preview starts. Local D1 state is empty on a
 * fresh checkout and in CI, and without the tables every write fails as a
 * storage error. `IF NOT EXISTS` makes it safe to repeat on a local machine that
 * already has them.
 */

const PORT = 4322;

/*
 * The notification recipient, a secret in production. Passed as process env,
 * which wrangler reads only with CLOUDFLARE_INCLUDE_PROCESS_ENV set.
 */
export const NOTIFY_TO = 'owner@example.com';
const BASE_URL = `http://localhost:${PORT}`;

/*
 * The comment secrets, test values at the minimum lengths the routes accept.
 * tests/comments.spec.ts signs links with the same key.
 */
export const COMMENTS_SIGNING_KEY = 'test-signing-key-'.padEnd(32, 'x');
export const COMMENTS_EXPORT_KEY = 'test-export-key-'.padEnd(32, 'x');

/*
 * The deploy hook, pointed at a stub tests/comments.spec.ts listens on, so an
 * approval's rebuild request can be observed without starting a real build.
 */
export const DEPLOY_HOOK_PORT = 4323;
export const DEPLOY_HOOK_PATH = '/deploy-hook';

const MIGRATIONS = [
  'migrations/0001_create_messages.sql',
  'migrations/0002_create_comments.sql',
];

export default defineConfig({
  testDir: './tests',
  testMatch: ['contact.spec.ts', 'comments.spec.ts', 'video-range.spec.ts'],
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
      MIGRATIONS.map(
        (file) =>
          ` && npx wrangler d1 execute sinduri-lol --local --file ${file}`,
      ).join('') +
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
    env: {
      ASTRO_PREVIEW_BACKGROUND: '1',
      CLOUDFLARE_INCLUDE_PROCESS_ENV: 'true',
      CONTACT_NOTIFY_TO: NOTIFY_TO,
      COMMENTS_SIGNING_KEY,
      COMMENTS_EXPORT_KEY,
      COMMENTS_DEPLOY_HOOK: `http://127.0.0.1:${DEPLOY_HOOK_PORT}${DEPLOY_HOOK_PATH}`,
    },

    reuseExistingServer: false,
    timeout: 120_000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
});
