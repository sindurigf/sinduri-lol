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

Then drop the self-hosted font files into `public/fonts/`. They are not in the
repo. The build warns once per missing file until they are added.

```
public/fonts/lexend-300.woff2
public/fonts/lexend-400.woff2
public/fonts/lexend-700.woff2
public/fonts/lexend-800.woff2
public/fonts/lexend-900.woff2
```

## Commands

| Command           | Does                                        |
| ----------------- | ------------------------------------------- |
| `npm run dev`     | Dev server at `http://localhost:4321`       |
| `npm run build`   | Static build to `dist/`                     |
| `npm run preview` | Serve the built `dist/` locally             |
| `npm run astro`   | Astro CLI passthrough                       |

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

| Setting            | Value           |
| ------------------ | --------------- |
| Framework preset   | Astro           |
| Build command      | `npm run build` |
| Build output       | `dist`          |
| Node version       | `22.12.0` or newer |

Set `NODE_VERSION` in the Pages environment variables if the default runtime is
older than 22.12.

## Conventions

Design system, tokens, commit format, and code conventions are documented in
[AI.md](AI.md).
