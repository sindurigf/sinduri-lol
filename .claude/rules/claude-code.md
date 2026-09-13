# Claude Code

Rules for Claude Code only. `CLAUDE.md` is a symlink to `AGENTS.md`, which every
agent reads; this file is loaded by Claude Code alone.

## Tools

- Invoke the `sinduri-design-system` skill before any UI, colour or component
  work, and `frontend-a11y` before writing markup.
- Use the `chrome-devtools` MCP server from `.mcp.json` for rendering, focus,
  zoom and Lighthouse checks against a running page.
- There are no Cloudflare credentials here: `wrangler` is not logged in. For
  dashboard changes, check the plan's limits in Cloudflare's docs, give the
  user the exact steps, then verify with `curl` and `npm run check:live`.

## Working tree

- Work in the main checkout, so changes show up in the user's editor. Use a
  worktree under `.claude/worktrees/` only when asked or when another session
  is using the main checkout, and remove it once its pull request is merged.
- Never symlink `node_modules` into a worktree. `node_modules/` in
  `.gitignore` ignores directories only, so the symlink would be committed.

## Settings

- `.claude/settings.json` sets commit and pull request attribution to empty.
  Do not add a `Co-Authored-By` trailer by hand.
- The task checklist is `tmp/TODO.md`, injected by a user-level hook. Do not
  add a project hook or status line for it: a project `statusLine` replaces
  the user's.
