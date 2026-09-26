# sinduri.lol

Source of [sinduri.lol](https://sinduri.lol), the personal site of Sinduri
Guntupalli, Open Source Enthusiast.

## Stack

- [Astro](https://astro.build) 7, static output; `/contact/send/` renders on
  demand in the Worker
- [Vue](https://vuejs.org) 3 for one island (the homepage canvas hero); plain
  modules for other scripts
- [Tailwind CSS](https://tailwindcss.com) 4, tokens in `src/styles/global.css`
- TypeScript, strict, checked with `astro check` and `vue-tsc`
- Markdown content collections, rendered by Sätteri
- Lexend, self-hosted through Fontsource
- Cloudflare: Workers static assets, D1 (EU), Rate Limiting, Email Routing,
  Workers Builds
- [Playwright](https://playwright.dev) in Chromium, Firefox and WebKit with
  [axe-core](https://github.com/dequelabs/axe-core) for WCAG 2.2 AA
- Node.js from `.nvmrc`

## Quick start

Needs [nvm](https://github.com/nvm-sh/nvm) or Node.js at the `.nvmrc`
version. No Cloudflare account or secrets: dev, build and every test suite run
locally.

```sh
nvm use
npm ci
npx playwright install --with-deps chromium firefox
npm test      # builds, then runs the Playwright and Worker suites
npm run dev   # http://localhost:4340
```

Before calling a change done, run the commands in [AGENTS.md](AGENTS.md).
WebKit runs locally through Docker:
[docs/DEVELOPMENT.md](docs/DEVELOPMENT.md#webkit).

## Documentation

- [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md): commands, layout, posts, talks,
  the CV
- [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md): Cloudflare, D1, email, Umami,
  dashboard settings
- [ARCHITECTURE.md](ARCHITECTURE.md): stack, tokens, content, assets, headers
- [docs/STYLEGUIDE.md](docs/STYLEGUIDE.md): visual rules and page patterns
- [ACCESSIBILITY.md](ACCESSIBILITY.md): conformance statement, known gaps,
  and how to report a barrier
- [docs/MANUAL_TESTING.md](docs/MANUAL_TESTING.md): by-hand accessibility checks
- [AGENTS.md](AGENTS.md): working rules
- [AI_DISCLOSURE.md](AI_DISCLOSURE.md): AI tooling used; none at runtime

## Contributing

Issues are welcome, including accessibility barriers
([how to report one](ACCESSIBILITY.md)). Pull requests use
[the template](.github/PULL_REQUEST_TEMPLATE.md) and the rules in
[AGENTS.md](AGENTS.md).

## License

- Source code: MIT, see [LICENSE](LICENSE).
- Content: all rights reserved, copyright Sinduri Guntupalli or the credited
  creator. Covers `src/content/`, `src/assets/` except `social-icons.svg`,
  `artwork/`, `public/images/`, `public/talks/`,
  `public/sinduri-guntupalli-cv.pdf` and the icons in `public/`.
- `src/assets/social-icons.svg`: brand icon paths from
  [Simple Icons](https://simpleicons.org), CC0 1.0.
- Lexend: SIL Open Font License 1.1, copyright 2019 The Lexend Project Authors.
- The build writes `/licenses.txt` covering every third-party package, vendored
  script and font sent to a browser (`scripts/licenses.mjs`).
