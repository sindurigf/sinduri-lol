# AI disclosure

How AI tooling was used to build this repository.

| Item   | Detail                                                                                                                               |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| Model  | Claude (Anthropic)                                                                                                                   |
| Tool   | Claude Code, as a VS Code extension                                                                                                  |
| Design | Stitch (Google) for design, Claude Design (Anthropic) for refinement, as on `/credits`                                               |
| Scope  | Scaffolding, components, design tokens, functional microcopy, `/accessibility` and `/privacy` disclosure, docs, a11y fixes and tests |

## Review

- I direct the work: every design, behaviour and copy change is my decision,
  reviewed in the browser before it ships.
- I review changes by what they do, not line by line. Every change must pass the
  build, typecheck, convention and format checks, and the test suites, including
  automated WCAG 2.2 AA checks in Chromium, Firefox and WebKit. The code also
  goes through independent adversarial reviews, and their findings are fixed
  before it is published.
- Review findings, from a person, a tool or an agent, are checked against the
  code before they are acted on;
  [AGENTS.md](AGENTS.md#review-findings) says how.
- Automated checks do not cover everything:
  [ACCESSIBILITY.md](ACCESSIBILITY.md#7-known-gaps) lists what still needs
  manual testing.

## Attribution

- Recorded here once for the repository, not per commit.
- Commits carry no AI trailer ([AGENTS.md](AGENTS.md#commits)).
- A missing trailer says nothing about whether AI was involved.
- A `Co-Authored-By:` naming a person is kept.

## No AI at runtime

- The site is a static build; no model runs, in the browser or on the server.
- No visitor data is sent to a model.
- No AI-written editorial copy or images are served. Functional microcopy and
  the `/accessibility` and `/privacy` disclosure are agent-written by design
  ([AGENTS.md](AGENTS.md#copy)).

## Keeping this current

Update this file in the same commit when the model, tool or scope changes, when
AI writes editorial copy that ships (label it on the page too), when any AI runs
at runtime, or when the review process changes.
