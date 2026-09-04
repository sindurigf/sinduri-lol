# AI disclosure

This document records how AI tooling was used to build this site. It covers the
repository, not the site's visitors.

## What was used

| Item  | Detail                                                          |
| ----- | --------------------------------------------------------------- |
| Model | Claude (Anthropic)                                              |
| Tool  | Claude Code, run as a VS Code extension                         |
| Scope | Scaffolding, component authoring, and accessibility remediation |

Specifically: project scaffolding and configuration, authoring Astro and Vue
components, design token work, accessibility remediation, and the automated
accessibility test suite.

## Review

All AI output is reviewed by a human before it is merged. Generated code is
read, built, typechecked, and run against the accessibility suite in
[ACCESSIBILITY.md](ACCESSIBILITY.md) before it lands on `main`.

Review is a human responsibility. Nothing merges because a model produced it.

## No AI at runtime

No AI runs when someone visits this site.

- The site is a static build. Every page is HTML generated ahead of time.
- There is no client-side AI, no inference, no model call from the browser.
- No AI-generated prose, images, or other content is served to visitors.
- No visitor data is sent to a model.

AI is a build-time authoring tool here and nothing more.

## Keeping this current

Update this file in the same commit as the change it describes. It is wrong the
moment the tooling changes without it.

Update it when any of the following happen:

- a different model or vendor is used
- a different tool or interface is used to run the model
- AI is used for something outside the scope listed above, in particular for
  writing prose that ships to visitors
- any AI starts running at runtime, on the server or in the browser
- the human review process changes

If AI-generated content is ever published to visitors, say so here and label it
where it appears.

## Questions

Open an issue on the repository.
