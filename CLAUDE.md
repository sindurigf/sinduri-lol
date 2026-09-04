# CLAUDE.md

Personal site for sinduri.lol. Astro 7, Vue 3 islands, Tailwind 4, TS strict,
static output. Read the pointers below before changing anything; do not copy
their content into this file.

## Git and PR workflow

- `main` is protected by a branch ruleset. Direct pushes are rejected. Always
  branch, and name the branch for the task.
- The required status check is the GitHub _context_ name, which comes from
  `jobs.a11y.name` in `.github/workflows/a11y.yml` and not from the job key.
  Renaming that string silently removes protection from `main`.
- `gh` is the tool for pull requests. Run `gh auth status` before relying on
  it; if it is unauthenticated, stop and say so. Printing a `compare/` URL is
  not opening a pull request.
- `gh pr create --base main --title "<conventional title>"`. Never `--fill`:
  it bypasses [the PR template](.github/PULL_REQUEST_TEMPLATE.md) and its
  accessibility checklist.
- Report the PR URL. Never merge. The human reviews and merges.
- Commit per logical unit, so the PR is reviewable commit by commit.

## Commits

Format: `type: Full sentence with a full stop.`, signed off (`git commit -s`).

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `chore`, `perf`, `security`,
`config`, `revert`, `test`.

Example: `feat: Add Header component with sticky nav and active indicator.`

CI checks this on every pull request, over the commits the branch adds, via
`scripts/check-commits.sh`. Merge commits are skipped: GitHub writes those and
signs off nothing.

Some historical commits carry a `Co-Authored-By:` trailer and some do not.
Attribution is now configured off in `.claude/settings.json`, with
`.githooks/commit-msg` as a backstop, and CI as the third layer, because hooks
are not cloned and `core.hooksPath` is opt-in. The CI check deliberately looks
only at what a branch adds, never at full history: two commits already on
`main` carry the trailer, and [AI_DISCLOSURE.md](AI_DISCLOSURE.md) explains why
the history is left inconsistent rather than rewritten.

## Where things are documented

- [AI.md](AI.md) — stack, design system, tokens, content schema, assets, conventions
- [ACCESSIBILITY.md](ACCESSIBILITY.md) — conformance statement and known gaps
- [README.md](README.md) — setup, deploy, security headers, the branch ruleset
- `.claude/skills/sinduri-design-system/` — read before any UI, colour, or component work
- `.claude/skills/frontend-a11y/` — general accessible markup practice
- `design/` — the design comps, gitignored, structural reference for every page

## Hard rules

- Never invent editorial copy. Functional microcopy is agent-authored;
  editorial copy waits for Sinduri. AI.md defines both.
- Never commit anything from `design/`, especially the CV PDF.
- Ask before installing packages.

Run `npm run build`, `npm run typecheck`, and `npm run test:a11y` before
calling any change done.
