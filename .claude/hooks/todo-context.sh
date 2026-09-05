#!/usr/bin/env bash
# Prints TODO.md into session context on SessionStart and UserPromptSubmit.
set -euo pipefail

# CLAUDE_PROJECT_DIR is set by the harness; the fallback keeps the hook working
# if it is ever absent, since a silent no-op is indistinguishable from an empty file.
repo_root="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
todo_file="$repo_root/TODO.md"

[ -f "$todo_file" ] || exit 0

printf '%s\n\n' "The contents of $todo_file, this repository's durable task checklist, follow."
cat "$todo_file"
