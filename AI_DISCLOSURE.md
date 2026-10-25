# AI disclosure

How AI tooling was used to build this site.

| Item  | Detail                                                                                                                                                                                                        |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Model | Claude (Anthropic)                                                                                                                                                                                            |
| Tools | Claude Code; Stitch (Google) and Claude Design (Anthropic) for design; Canva AI for the rabbit and cat drawings and the logo                                                                                  |
| Scope | Code, tests, docs, functional microcopy, the `/accessibility` and `/privacy` text, the About cat drawings, the home page hero bunny, the footer bunny, the logo and site icons, and editing my editorial copy |

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
- AI-made and listed under
  [Made with AI on `/credits/`](https://sinduri.lol/credits/#ai):
  - the hopping bunny in the homepage hero, drawn with Canva AI and traced
    with Potrace (`src/assets/hero-rabbit.svg`, `src/lib/hero-field-rabbit.ts`),
    its stills shown without JavaScript (`src/assets/hero-still-*.webp`) and
    its raster for the Let It Fall climb (`src/assets/hero-rabbit-climb.webp`);
  - the sticker bunny in the footer and on the 404 page, drawn with Canva AI and traced with
    Potrace (`src/assets/bunny-footer.svg`);
  - the jumping bunny in the header logo, the hero roundel, every favicon and
    app icon and the share images, the same Canva AI rabbit traced with Potrace
    (`artwork/rabbit-jump.json`, `scripts/make-logo.mjs`, `scripts/make-og.mjs`);
  - the line bunny on the `/about/` tile (`src/assets/bunny-dark.png`);
  - the animated cats on `/about/`, drawn with Canva AI from the cats' photos
    (`artwork/about-cats/`, packed by `scripts/make-about-cats.mjs`), their
    sleep, wake and trick-list icons (`src/components/AboutCats.astro`) and
    their trick icons (`src/lib/about-cats-tricks.json`). The cat photos are
    real.

## Keeping this current

Update this file in the same commit when the tools, scope, review or runtime
use change. AI-made drawings and animation are also listed on `/credits/`.
Realistic AI images, video or audio (deep fakes, EU AI Act Art. 50(4)), and any
editorial text I have not approved line by line, are labeled on the page that
shows them.
