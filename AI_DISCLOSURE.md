# AI disclosure

How AI tooling was used to build this site.

| Item  | Detail                                                                                                                                   |
| ----- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Model | Claude (Anthropic)                                                                                                                       |
| Tools | Claude Code; Stitch (Google) and Claude Design (Anthropic) for design                                                                    |
| Scope | Code, tests, docs, functional microcopy, the `/accessibility` and `/privacy` text, the About cat drawings, and editing my editorial copy |

## Review

- Every change is my decision, reviewed in the browser. It must pass the build,
  checks and test suites, including automated WCAG 2.2 AA checks in Chromium,
  Firefox and WebKit, and independent reviews.
- Review findings are checked against the code before anyone acts on them
  ([AGENTS.md](AGENTS.md#review-findings)).
- What automated checks miss is in
  [ACCESSIBILITY.md](ACCESSIBILITY.md#7-known-gaps).

## Editorial copy

- The words are mine. Claude drafted some of them from my answers and edited
  them for clarity; I approved every line and am responsible for it.

## Attribution

- Recorded here once. Commits carry no AI trailer, so a missing trailer says
  nothing either way; a `Co-Authored-By:` naming a person is kept.

## At runtime

- No AI runs on the site, and no visitor data is sent to a model.
- The drawn, animated cats on `/about/` are AI-made and labeled there; the
  cat photos are real.

## Keeping this current

Update this file in the same commit when the tools, scope, review or runtime
use change. AI-made images, and any editorial text I have not approved line by
line, are also labeled on the page.
