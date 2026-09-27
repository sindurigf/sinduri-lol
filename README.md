# sinduri.lol

Source of [sinduri.lol](https://sinduri.lol), the personal site of Sinduri
Guntupalli, Open Source Enthusiast.

## Stack

Astro, Vue islands, Tailwind CSS and TypeScript on Cloudflare Workers:
[ARCHITECTURE.md](ARCHITECTURE.md#stack).

## Quick start

Setup, commands and the local WebKit run:
[docs/DEVELOPMENT.md](docs/DEVELOPMENT.md#setup). Before calling a change done,
run the commands in [AGENTS.md](AGENTS.md#done-means).

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
