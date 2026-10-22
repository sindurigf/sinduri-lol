---
name: opencode-cheatsheet
description: Quick reference for OpenCode V2 — provider auth and API keys, model switching, TUI slash commands and keybinds, scrolling, config file locations and precedence, MCP servers, background service commands and troubleshooting. Use this skill whenever the user asks about an OpenCode command, keybind, config setting, provider, model or workflow, or says they need to check or remember something about OpenCode, even if they do not name the exact command.
---

# OpenCode cheatsheet

Answer from these tables first; fetch the [V2 docs](https://opencode.ai/v2/docs/)
only for depth. This is OpenCode V2 (`opencode --version`), never the V1 docs at
<https://opencode.ai/docs>. Machine-readable index:
<https://opencode.ai/v2/llms.txt>. Config schema:
<https://opencode.ai/config.json>.

## Auth and Providers

| Task                              | Command                                            |
| --------------------------------- | -------------------------------------------------- |
| Connect a provider in the TUI     | `/connect`, then `/models`                         |
| Connect from the CLI              | `opencode auth login [provider] [--method key]`    |
| List integrations                 | `opencode auth list`                               |
| Switch the active account         | `opencode auth switch <provider> <label>`          |
| Remove a saved account            | `opencode auth logout <provider> <label>`          |
| Move credentials between machines | `opencode auth export`, `opencode auth import`     |
| Key as an environment variable    | `opencode service set env ANTHROPIC_API_KEY <key>` |
| Remove an environment variable    | `opencode service unset env ANTHROPIC_API_KEY`     |
| Key on a one-off private server   | `ANTHROPIC_API_KEY=<key> opencode --standalone`    |

Keys and OAuth tokens live in the server's SQLite database
(`opencode debug paths db`), not in a JSON file. Never edit the database;
use the `auth` commands. `auth login` and OAuth need an interactive
terminal, so the user runs them, not the agent.

## Models

- New sessions start from `"model": "provider/model"` in
  `~/.config/opencode/opencode.json`.
- Switch mid-session with `/models`; the choice is per session and sticks.
- Cycle recent models with `F2`, backwards with `Shift+F2`.
- Favorite a model with `Ctrl+F` in the model dialog.
- Cycle model variants with `Ctrl+T`.
- Two keys for one provider: `opencode auth switch`. Keys for different
  providers need no switch; picking the other provider's model uses it.

## TUI Commands

| Command    | Purpose                                    |
| ---------- | ------------------------------------------ |
| `/connect` | Add or manage provider accounts            |
| `/models`  | Pick the session model                     |
| `/mcps`    | MCP servers; sign in to OAuth servers here |
| `Ctrl+P`   | Command palette with every command         |

Custom commands are Markdown files in `.opencode/commands/` (project) or
`~/.config/opencode/commands/` (global). The file body is the prompt
template: `$ARGUMENTS` is the whole argument string, `$1`, `$2` are
positional. Frontmatter sets `agent`, `model` or `subagent: true`. A shell
block wrapped in `!` and backticks inserts command output before the
prompt is submitted, but it runs outside the permission flow; only
trusted templates may use it.

## Keybinds

The leader key is `Ctrl+X`, written `<leader>`. Remap everything in
`~/.config/opencode/cli.json` under `keybinds`.

| Keys                         | Action                       |
| ---------------------------- | ---------------------------- |
| `Esc`                        | Interrupt the session        |
| `Ctrl+C`                     | Clear the input, again exits |
| `Ctrl+P`                     | Command palette              |
| `Ctrl+O`                     | Recent sessions and projects |
| `Ctrl+Tab`, `Ctrl+Shift+Tab` | Switch session tabs          |
| `Ctrl+Shift+T`               | Reopen the closed tab        |
| `Ctrl+R`, `Ctrl+D`           | Rename, delete the session   |
| `Ctrl+B`                     | Background blocking tools    |
| `Shift+Tab`                  | Cycle agents                 |
| `F2`, `Shift+F2`             | Cycle recent models          |
| `Ctrl+T`                     | Cycle model variants         |
| `<leader>m`, `<leader>a`     | Model list, agent list       |
| `<leader>n`, `<leader>l`     | New session, session list    |
| `<leader>u`, `<leader>r`     | Undo, redo the last message  |
| `<leader>c`                  | Compact the session          |
| `<leader>b`, `<leader>t`     | Sidebar, terminal pane       |
| `<leader>s`, `<leader>x`     | Status, export the session   |
| `<leader>y`                  | Copy a message               |

## Scrolling

The session view scrolls by keyboard; the mouse wheel only works in the
diff viewer's file tree.

| Keys                       | Action              |
| -------------------------- | ------------------- |
| `PageUp`, `PageDown`       | One page            |
| `Ctrl+Alt+B`, `Ctrl+Alt+F` | One page, vim-style |
| `Ctrl+Alt+Y`, `Ctrl+Alt+E` | One line            |
| `Ctrl+Alt+U`, `Ctrl+Alt+D` | Half a page         |
| `Ctrl+G`, `Home`           | First message       |
| `Ctrl+Alt+G`, `End`        | Last message        |
| `Alt+End`                  | Last user message   |

Inside a dialog the arrows navigate and `Esc` closes; close it before
scrolling. If `PageUp` and `PageDown` do nothing, the terminal or tmux is
eating the keys; remap `session.page.up` in `cli.json`. A scrollbar exists
as `session.toggle.scrollbar` with no default binding. In `opencode mini`
there is no TUI scrolling; use the terminal's own scrollback.

## Config Files

Precedence, lowest to highest: `~/.config/opencode/opencode.json`, ancestor
`opencode.json` files, project `opencode.json`, `.opencode/opencode.json`.
TUI preferences live separately in `~/.config/opencode/cli.json`.

- Include `"$schema": "https://opencode.ai/config.json"` in every config.
- Reference secrets as `"{env:VAR_NAME}"`, never as a literal key.
- `opencode.json` holds server and project config; `cli.json` holds
  terminal preferences. Never put keybinds in `opencode.json`.

## CLI

| Command                                        | Purpose                                  |
| ---------------------------------------------- | ---------------------------------------- |
| `opencode [dir]`                               | TUI in a project                         |
| `opencode run "prompt"`                        | One-shot prompt for scripts and CI       |
| `opencode mini`                                | Minimal interface                        |
| `opencode --standalone`                        | Private server instead of the shared one |
| `opencode --server <url>`                      | Connect to a specific server             |
| `opencode pair`                                | Web UI link, expires in five minutes     |
| `opencode mcp add <name> --global --url <url>` | Add an MCP server                        |
| `opencode mcp list`                            | List MCP servers                         |
| `opencode service status`, `restart`           | Background service                       |
| `opencode service set env <var> <value>`       | Environment for the shared service       |
| `opencode debug paths [key]`                   | Filesystem locations                     |
| `opencode api get /api/info`                   | HTTP API of the running server           |

## MCP

- Configure under `mcp.servers` in `opencode.json`, or add with
  `opencode mcp add`.
- OAuth servers sign in through `/mcps` in the TUI; never paste OAuth
  credentials into config.
- Header auth when OAuth is unavailable: `"{env:MCP_API_KEY}"`.

## Troubleshooting

- `opencode service status`, and `opencode service restart` when stuck.
- Isolate shared-service problems with `opencode --standalone`.
- Logs: `~/.local/share/opencode/log/opencode.log`, or
  `opencode debug paths log`.
- Verbose run: `OPENCODE_LOG_LEVEL=DEBUG opencode`.
- Redact keys, tokens and prompts before sharing logs or diagnostics.
