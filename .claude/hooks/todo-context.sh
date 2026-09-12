#!/usr/bin/env bash
# Prints an index of TODO.md's open items into session context on SessionStart
# and UserPromptSubmit: a count, then the line number and first line of each.
# It is an index, not the checklist. Read TODO.md for the detail.
#
# WHY NOT THE WHOLE FILE. Claude Code replaces hook output above a size cap with
# a ~2 KB preview and a file path, so the file never arrived whole. Measured
# 2026-09-11: the full file was 48,487 bytes emitted and delivered as a
# 2,239-byte preview. 446 hook events across 47 transcripts put the cap between
# 9,836 bytes (delivered whole) and 10,149 (preview). The behaviour appeared in
# Claude Code 2.1.263 on 2026-09-09. Keep this output well under 9,836 bytes;
# the guard below says so in the output when it is not.
set -euo pipefail

# CLAUDE_PROJECT_DIR is set by the harness; the fallback keeps the hook working
# if it is ever absent, since a silent no-op is indistinguishable from an empty file.
repo_root="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
todo_file="$repo_root/TODO.md"

readonly MAX_LINE_CHARS=140
readonly WARN_BYTES=9000

[ -f "$todo_file" ] || exit 0

# Character-aware truncation, so a multibyte character is never cut in half.
open_items=$(grep -n '^- \[ \]' "$todo_file" |
  LC_ALL=C.UTF-8 sed -E "s/^(.{$((MAX_LINE_CHARS - 3))}).{4,}$/\1.../" || true)
count=$(printf '%s' "$open_items" | grep -c '' || true)

index=$(printf '%s\n%s\n\n%s' \
  "Open items in $todo_file: $count. Line number and first line of each." \
  "This is an index, not the checklist: read TODO.md before printing the checklist or ticking a box." \
  "$open_items")

bytes=$(printf '%s' "$index" | wc -c)
if [ "$bytes" -gt "$WARN_BYTES" ]; then
  printf 'WARNING: this index is %s bytes, close to the ~10,000-byte cap above which it arrives as a preview. Lower MAX_LINE_CHARS in .claude/hooks/todo-context.sh.\n\n' "$bytes"
fi
printf '%s\n' "$index"
