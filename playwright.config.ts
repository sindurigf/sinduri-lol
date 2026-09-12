import { defineConfig, devices } from '@playwright/test';

/*
 * WebKit is defined in CI, and locally only when asked for. The note on
 * `projects` says why this is a condition rather than a third entry.
 */
const WEBKIT = Boolean(process.env.CI) || process.env.WEBKIT === '1';

/*
 * @playwright/test is pinned exactly, and package.json carries no caret.
 *
 * 1.63.0 intermittently stops delivering navigation lifecycle events for
 * Firefox. `page.goto` then never returns and burns its whole 30s budget
 * against a page that has already finished loading and hydrating. `load`,
 * `domcontentloaded` and `commit` stall alike, because they read the same
 * event stream, so no `waitUntil` avoids it. Every stall recorded here is at
 * `page.goto` in tests/headers.spec.ts, the one spec that navigates to an
 * origin other than the preview server.
 *
 * The pin reduces this. It does not remove it. Measured on this machine,
 * firefox 153.0: 1.63.0 stalled in 8 of 22 runs of the firefox project and
 * 1.62.1 in none of 16, but on 1.62.1 the stall still appears in about 5 of
 * 105 tests/headers.spec.ts executions (2026-09-08 and 09, local and CI
 * pooled). `retries` below is what covers the remainder.
 *
 * The caret is the point: `^1.62.1` resolves back to 1.63.0 on the next
 * `npm i` and the flake returns. Nothing is lost by standing here. 1.63.0 was
 * adopted for a `test.use` emulation fix this suite does not rely on, because
 * tests/forced-colors.spec.ts and tests/motion.spec.ts deliberately use
 * `page.emulateMedia`.
 *
 * One hazard when switching branches: `npx playwright install` prunes browser
 * builds the installed version does not reference, so moving between a branch
 * on 1.62.1 and one on 1.63.0 deletes the other's Firefox. The suite then
 * fails instantly with "Executable doesn't exist", which measured nothing
 * rather than passed. Re-run `npx playwright install firefox` after
 * switching.
 *
 * Revisit when a 1.63.x or later release fixes this; the pin is a workaround
 * for an upstream defect, not a preference. The figures are dated rather than
 * maintained.
 */

const PORT = 4321;
const BASE_URL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: './tests',
  /* Needs the Worker, which this suite's static server is not; see
   * playwright.worker.config.ts. */
  testIgnore: 'contact.spec.ts',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  /*
   * One retry in CI, none anywhere else. This is a concession to the Firefox
   * stall above, which is in the harness rather than the page, so a rerun
   * answers a different question from the first attempt.
   *
   * It hides nothing: Playwright reports a test that failed and then passed as
   * flaky, on its own line in the summary, so a flaky count above zero is a
   * signal to come back here, and a real defect fails twice and stays red.
   * Locally a failure should be reproduced rather than retried.
   *
   * Remove this when the upstream defect is fixed and the pin is lifted. The
   * two belong together.
   */
  retries: process.env.CI ? 1 : 0,
  /*
   * Two workers in CI, where this was 1 for as long as CI has run three
   * engines. Measured 2026-09-09 on hosted runners, three engines: about 38%
   * off the test step and 34% off the whole job, over two serial runs and four
   * two-worker runs.
   *
   * The worry that argued against it, that parallelism changes the flake
   * characteristics of a suite measuring layout, did not materialise: nothing
   * in tests/alignment.spec.ts, tests/reflow.spec.ts, tests/hero-fit.spec.ts,
   * tests/target-size.spec.ts, tests/focus.spec.ts or
   * tests/gold-surface.spec.ts failed or flaked, and every flake was the known
   * Firefox stall, signature checked. That is a small sample: read it as no
   * sign of the problem rather than proof of none, and watch the flaky line.
   *
   * Nothing above 2 was tested. Both workers share the single `astro preview`
   * that `webServer` below starts, so raising this adds contention on one
   * server as well as on the runner's cores, and needs its own measurement.
   *
   * The figures are dated rather than maintained.
   */
  workers: process.env.CI ? 2 : undefined,
  /*
   * `html` in CI is what the upload step in a11y.yml uploads. Without it
   * `playwright-report/` is never written, that step's `if-no-files-found:
   * ignore` skips it without a word, and the trace `on-first-retry` records is
   * left in `test-results/` on a runner that is then thrown away, so a failed
   * CI run leaves nothing to download. The HTML report carries each test's
   * attachments, the trace included. `open: 'never'` because there is nobody
   * on the runner to open it.
   */
  reporter: process.env.CI
    ? [['github'], ['list'], ['html', { open: 'never' }]]
    : [['list']],

  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
  },

  /*
   * Chromium and Firefox run everywhere; WebKit runs in CI, and locally only
   * with WEBKIT=1.
   *
   * Firefox passed the whole suite on its first run (firefox 153.0,
   * 2026-09-05) with no source change and no browser-conditional assertion
   * anywhere in tests/. <dialog> and showModal() behave, which is what the
   * cross-browser item was really about, and reduced-motion emulation
   * activates.
   *
   * Forced colours differ by engine, which is worth knowing before anyone
   * asserts a colour: chromium substitutes a light system palette that follows
   * `colorScheme`, firefox a dark one that does not move at all, and webkit
   * matches the media query without forcing anything. Nothing asserts a
   * particular colour. tests/forced-colors.spec.ts checks the palette was
   * actually substituted rather than that the query matches, so an engine
   * where the emulation did nothing fails loudly; webkit is skipped there for
   * that reason.
   *
   * WebKit cannot run on the development machine, which is an operating system
   * fact rather than a missing package. Playwright builds WebKit against ICU
   * 74 (Ubuntu 24.04); this machine is Ubuntu 25.10, which ships ICU 76, and
   * ICU has no ABI compatibility across majors, so `libicu74` is in no 25.10
   * repository and `npx playwright install-deps` cannot help. CI's runner is
   * 24.04, where `--with-deps` supplies the libraries.
   *
   * This is the one place CI runs something a local run does not, and this
   * repository otherwise treats that drift as a defect (see the .nvmrc
   * reasoning in README). The difference is not a choice between two
   * configurations: one machine cannot execute the binary, and a suite that is
   * red for a reason the developer cannot fix is worse than one that is honest
   * about where it ran.
   *
   * To run WebKit locally, in Playwright's own container:
   *
   *   docker run --rm --ipc=host --user $(id -u):$(id -g) \
   *     -v "$PWD":/work -w /work \
   *     mcr.microsoft.com/playwright:v1.62.1-noble \
   *     bash -c "npm ci && WEBKIT=1 npx playwright test --project=webkit"
   *
   * `--user` is load-bearing. The image runs as root, the working tree is
   * bind-mounted, and `npm ci` rewrites node_modules inside it, so without the
   * flag the run leaves node_modules, dist/ and test-results/ owned by root
   * (measured 2026-09-09). Nothing is lost, all of it being gitignored and
   * regenerable, but the next `npm run typecheck` fails with EACCES because of
   * a container that exited half an hour earlier. Recovery is another
   * container rather than sudo:
   *
   *   docker run --rm -v "$PWD":/work -w /work alpine \
   *     chown -R $(id -u):$(id -g) /work
   */
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    ...(WEBKIT
      ? [{ name: 'webkit', use: { ...devices['Desktop Safari'] } }]
      : []),
  ],

  // Playwright owns the server lifecycle: it builds the site, serves the built
  // output with `astro preview`, waits for the port, and tears it down. The
  // tests run against the real static build, not the dev server.
  webServer: {
    /*
     * `scripts/preview-static.mjs`, not `astro preview`. Since the Cloudflare
     * adapter landed, preview serves through the Worker, which applies
     * `public/_headers` and so `upgrade-insecure-requests`. WebKit honours that
     * on loopback where Chromium and Firefox do not, fetches every subresource
     * over TLS from an http server, and loads nothing: 437 tests failed on
     * timeouts and CI passed its 35-minute cap. That script carries the
     * measurement and says what covers the headers instead.
     */
    command: `npm run build && node scripts/preview-static.mjs`,
    url: BASE_URL,
    env: { PORT: String(PORT) },

    /*
     * Never reuse a server this run did not start. Reusing one makes
     * Playwright skip the whole command, `npm run build` included, so the
     * suite asserts against whatever dist/ last held: a run could pass on
     * stale CSS and look identical to a real pass.
     */
    reuseExistingServer: false,

    timeout: 120_000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
});
