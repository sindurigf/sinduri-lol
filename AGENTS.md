# AGENTS.md

Working rules for anyone, human or agent, changing this repository. The stack,
the design system and the conventions are in [ARCHITECTURE.md](ARCHITECTURE.md).

## Before calling anything done

```sh
npm run build
npm run typecheck
npm run check
npm run test:a11y
npm run test:worker
```

`check` runs the token, link, format and commit checks. `test:worker` runs the
contact endpoint spec through the Worker, which the static server `test:a11y`
uses cannot serve. The required CI job runs all five.

A suite is green only when the summary line with the counts says so. Check the
reported total against `npx playwright test --list`: a total below the collected
count means those tests did not run, not that they passed, and nothing in the
output is coloured to say so.

If two runs of unchanged code disagree, the cause is environmental until
measured otherwise. Look for a backgrounded Astro daemon, another session
writing to this tree, memory pressure or lockfile resolution before reading the
diff.

## Git and pull requests

- `main` is protected by a branch ruleset. Direct pushes are rejected. Always
  branch, and name the branch for the task.
- The required status check is the GitHub context name, which comes from
  `jobs.a11y.name` in `.github/workflows/a11y.yml` and not from the job key.
  Renaming that string silently removes protection from `main`.
- `gh` is the tool for pull requests. Run `gh auth status` before relying on it.
  Printing a `compare/` URL is not opening a pull request.
- `gh pr create --base main --title "<title>" --body-file <file>`, where the
  file is [the PR template](.github/PULL_REQUEST_TEMPLATE.md) with every section
  answered. Never `--fill`: it bypasses the template and its accessibility
  checklist.
- Report the PR URL. Never merge. The human reviews and merges.
- Commit per logical unit, so the PR is reviewable commit by commit.

## Commits

Format: `type: Full sentence with a full stop.`, signed off (`git commit -s`).
No scope, and a capital letter after the colon: `scripts/check-commits.sh`
rejects `feat(header): ...` and a lower-case first word.

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `chore`, `perf`, `security`,
`config`, `revert`, `test`.

Example: `feat: Add Header component with sticky nav and active indicator.`

No AI attribution trailer in commit messages or pull request descriptions.
Attribution is recorded once for the project in
[AI_DISCLOSURE.md](AI_DISCLOSURE.md) instead. Three layers keep trailers out:
`.claude/settings.json`, `.githooks/commit-msg`, and `scripts/check-commits.sh`
in CI, because hooks are not cloned and `core.hooksPath` is opt-in.

## Code

- Functional style. No classes unless there is a clear reason.
- No magic numbers. Config or named constants only.
- Self-documenting code. Comments only where intent is not obvious, and then
  stating the constraint and its consequence rather than restating the code.
- Validate external input at the boundary. Handle error paths explicitly and
  never swallow errors.
- Check for an existing pattern before introducing a new one.
- Prefer stdlib or an existing dependency over adding a package. **Ask before
  installing anything not already in `package.json`.**
- Vue is for components with real state: the mobile menu dialog, the canvas
  hero, the badge. A small script that nothing else depends on is a plain
  module, not an island.

## Copy: two kinds, two different rules

"Never invent copy" is two rules that need opposite treatment.

**Functional microcopy is agent-authored by default.** 404 body text, the skip
link, `aria-label` and `aria-describedby` text, button and form-control labels,
error and validation messages, empty states, `alt` text, the visually hidden
text that gives a control its accessible name. Write it. Do not leave it as
`PLACEHOLDER`.

This text is part of how the interface works rather than part of what the site
says. A `PLACEHOLDER` skip link or error message is not a neutral gap waiting to
be filled: it is a broken control, and it is broken specifically for the people
who depend on it most. Keep it plain, short, second person, and never blame the
reader.

**Editorial copy is never invented.** Blog posts, About, Career, taglines,
project descriptions, bios, the homepage hero line, anything with a voice or a
claim about Sinduri. This stays lorem ipsum until she writes it, at the length
the comps' real copy occupies, so it is obvious at a glance and greppable.

The test is whose voice it is. If the sentence could only be written by the
person whose site this is, it is editorial and it waits. If it would read the
same on any competent website, it is functional and it gets written now. Where
the two meet, split them: a Career section gets a real heading structure and
real control labels around lorem ipsum prose.

**A placeholder is a guess about length as much as about wording.** The tagline
replaced a four-line lorem paragraph the hero's vertical budget was built
around, and the real line is three short phrases. Treat a layout calibrated
against lorem as provisional in both.

## Hard rules

- Never commit anything from `design/`, especially the CV PDF there. The
  published CV is the scrubbed copy at `public/sinduri-guntupalli-cv.pdf`.
- Never invent editorial copy.
- Ask before installing packages.
- Read `.claude/skills/sinduri-design-system/` before any UI, colour or
  component work.

## Where things are documented

- [ARCHITECTURE.md](ARCHITECTURE.md) — stack, design system, tokens, content
  schema, assets, security headers, conventions
- [ACCESSIBILITY.md](ACCESSIBILITY.md) — conformance statement and known gaps
- [README.md](README.md) — setup, commands, deploy, hostnames, branch protection
- [AI_DISCLOSURE.md](AI_DISCLOSURE.md) — how AI tooling was used, and that none
  of it runs at runtime
- [docs/MANUAL_TESTING.md](docs/MANUAL_TESTING.md) — the by-hand checklist that
  closes the gaps in ACCESSIBILITY.md §7
- `.claude/skills/sinduri-design-system/` — the design system as a skill
- `design/` — the design comps, gitignored, structural reference for every page
- `tmp/` — local scratch, gitignored, including the task checklist
