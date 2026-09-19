# sinduri.lol

The source of [sinduri.lol](https://sinduri.lol), the personal site of Sinduri
Guntupalli: Open Source Enthusiast, Positivity Advocate.

Product and program management, web development, and community and ecosystem
management, with active involvement in the Drupal community. More on
[the career page](https://sinduri.lol/career/).

## Stack

**Site**

- [Astro](https://astro.build) 7, static output: every page is prerendered
- [Vue](https://vuejs.org) 3 islands for the stateful components (mobile menu,
  canvas hero); plain modules for small scripts
- [Tailwind CSS](https://tailwindcss.com) 4 through its Vite plugin, with design
  tokens in `src/styles/global.css`
- TypeScript 6, strict, checked with `astro check`
- Markdown content collection with a Zod schema, rendered by Sätteri
- Lexend variable font, self-hosted through Fontsource
- `@astrojs/sitemap`, a generated `/llms.txt`, JSON-LD structured data

**Hosting, on Cloudflare**

- Workers static assets serve the pages, with security headers from
  `public/_headers`
- One on-demand route, the contact form, through `@astrojs/cloudflare`
- D1 (EU jurisdiction) stores messages; a Cron Trigger deletes them after the
  retention period
- Workers Rate Limiting, keyed on a hashed address
- Email Routing forwards mail and sends contact form notifications
- Workers Logs and Traces; Workers Builds deploys `main`
- DNS with DNSSEC and CAA; Bulk Redirects for `www` and `pages.dev`

**Quality**

- [Playwright](https://playwright.dev) in Chromium and Firefox, plus WebKit in
  CI, with [axe-core](https://github.com/dequelabs/axe-core) for WCAG 2.2 AA
- A second Playwright suite that runs the contact endpoint through the Worker
  runtime with a local D1
- Scripts that fail on arbitrary design values, broken relative links and
  commit message format, and one that compares production with the repository
- Prettier, GitHub Actions with the Playwright suite split across six jobs, a
  ruleset that requires CI to pass before merging, and Dependabot
- Node.js 24, pinned in `.nvmrc`

## Run it locally

```sh
nvm use
npm install
npm run dev
```

## Documentation

- [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md): commands, project layout, writing
  a post
- [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md): Cloudflare, D1, email, dashboard
  settings, branch protection
- [ARCHITECTURE.md](ARCHITECTURE.md): stack, design system, content, security
  headers
- [ACCESSIBILITY.md](ACCESSIBILITY.md): conformance statement and known gaps
- [AGENTS.md](AGENTS.md): working rules for changing this repository
- [AI_DISCLOSURE.md](AI_DISCLOSURE.md): how AI tooling was used to build it

## License

Source code is MIT licensed; see [LICENSE](LICENSE). Lexend is licensed
separately under the SIL Open Font License 1.1, copyright 2019 The Lexend
Project Authors.
