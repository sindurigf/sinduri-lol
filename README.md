# sinduri.lol

Personal website. Astro 7, Vue 3 islands, Tailwind CSS 4, TypeScript strict,
static output, deployed to Cloudflare Pages.

## Requirements

- Node.js `>=22.12.0`
- npm `>=9.6.5`

## Setup

```sh
npm install
```

That is the whole setup. Fonts come from npm, so there are no files to drop in
by hand.

## Fonts

Lexend is installed as [`@fontsource-variable/lexend`][fontsource] and imported
in `src/layouts/BaseLayout.astro`. It is a variable font covering weights 100
to 900 on the `wght` axis, subsets latin, latin-ext, and vietnamese.

It is still self-hosted: Fontsource bundles the `.woff2` files into the build
and they are served from our own origin. No Google Fonts CDN, no third-party
request at runtime.

Lexend is licensed under the [SIL Open Font License 1.1][ofl], copyright 2019
The Lexend Project Authors. The full license text ships with the package at
`node_modules/@fontsource-variable/lexend/LICENSE`.

[fontsource]: https://fontsource.org/fonts/lexend
[ofl]: https://openfontlicense.org/

## Commands

| Command           | Does                                  |
| ----------------- | ------------------------------------- |
| `npm run dev`     | Dev server at `http://localhost:4321` |
| `npm run build`   | Static build to `dist/`               |
| `npm run preview` | Serve the built `dist/` locally       |
| `npm run astro`   | Astro CLI passthrough                 |

## Commit hooks

Commit messages here carry no AI attribution. Two things enforce that, and the
second exists because the first is not reliable on its own:

1. `.claude/settings.json` sets an empty attribution template for Claude Code.
2. `.githooks/commit-msg` strips any AI attribution that lands anyway.

Git does not clone hooks, so the hook has to be switched on once per checkout:

```sh
git config core.hooksPath .githooks
```

Do that after `npm install`. It is not wired into a `prepare` script on
purpose: that would run `git config` during CI and deploy installs, where
there is no developer checkout to configure and a failure would take the
install down with it.

The hook removes `Co-Authored-By:` lines naming Claude or Anthropic and the
`Generated with [Claude Code]` line. It deliberately leaves a `Co-Authored-By:`
line naming a person alone, because silently dropping a human collaborator's
credit would be a worse failure than the one it prevents.

## Project layout

```
src/
  components/       Astro components; ui/ holds the Vue islands
  layouts/          BaseLayout (head, header, footer) and BlogLayout
  pages/            File-based routes
  content/blog/     Blog posts as Markdown
  content.config.ts Content collection schema
  styles/global.css Fonts, design tokens, base layer, component classes
public/             Static assets served from the site root
```

## Writing a post

Add a Markdown file to `src/content/blog/`. The filename becomes the slug.
Frontmatter is validated against the Zod schema in `src/content.config.ts`, and
the build fails on anything that does not match. See
`src/content/blog/example-post.md` for a complete example.

## Deploy

Cloudflare Pages, static. No SSR adapter is configured.

| Setting          | Value              |
| ---------------- | ------------------ |
| Framework preset | Astro              |
| Build command    | `npm run build`    |
| Build output     | `dist`             |
| Node version     | `22.12.0` or newer |

Set `NODE_VERSION` in the Pages environment variables if the default runtime is
older than 22.12.

## Conventions

Design system, tokens, commit format, and code conventions are documented in
[AI.md](AI.md).

## MCP servers

`.mcp.json` declares one project-scoped MCP server, `chrome-devtools`, used to
drive a real browser when checking rendering, focus order, and zoom behaviour.

It is committed so the setup is shared, not per-machine. Claude Code asks for
approval the first time it starts the server in this repo; approve it once and
the prompt does not return. It is fetched with `npx` on first run, so that run
is slower and needs network access.

The `accesslint` server is deliberately not here. It is installed globally as a
Claude Code plugin with its own bundled MCP server.

## Accessibility

The conformance target, the known gaps, and how to report a barrier are in
[ACCESSIBILITY.md](ACCESSIBILITY.md).

## AI use

AI tooling was used to build this repository. What was used, how it is
reviewed, and the fact that no AI runs at runtime are documented in
[AI_DISCLOSURE.md](AI_DISCLOSURE.md).

## License

Source code is MIT licensed. See [LICENSE](LICENSE).

Lexend is licensed separately under the SIL Open Font License 1.1, copyright
2019 The Lexend Project Authors. See [Fonts](#fonts) above.
