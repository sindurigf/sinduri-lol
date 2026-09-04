import { defineConfig, devices } from '@playwright/test';

const PORT = 4321;
export const BASE_URL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [['github'], ['list']] : [['list']],

  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
  },

  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],

  // Playwright owns the server lifecycle: it builds the site, serves the built
  // output with `astro preview`, waits for the port, and tears it down. The
  // tests run against the real static build, not the dev server.
  webServer: {
    command: `npm run build && npm run preview -- --port ${PORT} --ignore-lock`,
    url: BASE_URL,

    /*
     * Never reuse a server this run did not start. `reuseExistingServer` used
     * to be `!process.env.CI`, so any preview server already on :4321 made
     * Playwright skip the whole command, including `npm run build`. The suite
     * then asserted against whatever was last written to dist/, which after
     * an edit to global.css or a component is the previous build. A run could
     * pass on stale CSS and it looked identical to a real pass. Every local
     * run now rebuilds, which is the only way the assertion means anything.
     *
     * The cost is that a preview server already on :4321 makes the run fail
     * with "port is already used" instead of silently reusing it. That is the
     * intended trade: stop it with `astro preview stop` and run again.
     */
    reuseExistingServer: false,

    /*
     * `astro preview` forks itself into the background when it detects an AI
     * coding agent (Astro 7 does this via `am-i-vibing`). Playwright sees the
     * foreground process exit immediately and reports "Process from
     * config.webServer exited early", so the suite cannot start its own server
     * at all in an agent session, which is most of how this repo is developed.
     *
     * ASTRO_PREVIEW_BACKGROUND is the marker Astro's own launcher sets on the
     * child it forks. Setting it here says "you are already the process that
     * was going to be forked", so the CLI skips agent detection and stays in
     * the foreground. The name reads backwards from the outside; it is doing
     * the opposite of what it sounds like.
     *
     * `--ignore-lock` goes with it: the foreground path otherwise writes a
     * lock file and refuses to start if one is present, which would turn a
     * leftover lock into a failed test run.
     */
    env: { ASTRO_PREVIEW_BACKGROUND: '1' },

    timeout: 120_000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
});
