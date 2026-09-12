# AI disclosure

How AI tooling was used to build this site. It covers the repository, not the
site's visitors.

## What was used

| Item  | Detail                                                                                                                   |
| ----- | ------------------------------------------------------------------------------------------------------------------------ |
| Model | Claude (Anthropic)                                                                                                       |
| Tool  | Claude Code, run as a VS Code extension                                                                                  |
| Scope | Scaffolding, component authoring, functional microcopy, factual disclosure, documentation, and accessibility remediation |

Specifically: project scaffolding and configuration, authoring Astro and Vue
components, design token work, functional microcopy, the factual disclosure on
`/accessibility` and `/privacy`, documentation, accessibility remediation, and
the automated accessibility test suite.

## Review

All AI output is reviewed by a human before it is merged. Generated code is
read, built, typechecked, and run against the accessibility suite before it
lands on `main`. Nothing merges because a model produced it.

## Attribution is at the project level, not per commit

Commit messages carry no AI attribution trailer. Three layers keep them that
way: the setting in `.claude/settings.json`, the `commit-msg` hook in
`.githooks/`, and `scripts/check-commits.sh` in CI.

That is a deliberate choice about where the disclosure belongs, not an attempt
to hide it. A trailer on every commit is noise that says the same thing 300
times and still leaves a reader guessing about the commits without one. This
file says it once, for the whole repository. **The absence of a trailer on a
commit says nothing about whether AI was involved in it.**

A `Co-Authored-By:` line naming a person is left alone. Dropping a human
collaborator's credit is a worse failure than the one this prevents.

## No AI at runtime

No AI runs when someone visits this site.

- The site is a static build. Every page is HTML generated ahead of time.
- There is no client-side AI, no inference, no model call from the browser.
- No AI-generated editorial copy or images are served to visitors. Two kinds of
  agent-written text are, by design: functional microcopy, and the factual
  disclosure on `/accessibility` and `/privacy`.
  [AGENTS.md](AGENTS.md#copy-two-kinds-two-different-rules) defines the
  difference.
- No visitor data is sent to a model.

AI is a build-time authoring tool here and nothing more.

## Keeping this current

Update this file in the same commit as the change it describes. Update it when:

- a different model, vendor, tool or interface is used;
- AI is used for something outside the scope above, in particular for writing
  editorial copy that ships to visitors;
- any AI starts running at runtime, on the server or in the browser;
- the human review process changes.

If AI-generated editorial copy is ever published to visitors, say so here and
label it where it appears. Functional microcopy and factual disclosure are not
labelled on the page: they are agent-written by design, and this file says so.
