#!/bin/sh
#
# Checks every non-merge commit in a range against the conventions in
# AGENTS.md: the subject format, the sign-off, and the absence of AI
# attribution.
#
# .githooks/commit-msg strips attribution as commits are written, but hooks are
# not cloned and `git config core.hooksPath .githooks` is opt-in, so a clone
# that never ran it has no protection. This runs in CI, where opting out is not
# possible.
#
# Merge commits are skipped: GitHub writes them, signs off nothing, and they
# are not ours to format. Dependabot's are skipped by author address for the
# same reason, and the rest of the CI job still gates them. Anyone can set an
# author address, so this is a convention check, not access control.
#
# Usage: sh scripts/check-commits.sh [range]     (default origin/main..HEAD)

set -eu

RANGE=${1:-origin/main..HEAD}

# From AGENTS.md, including `test` for test-only commits.
TYPES='feat|fix|docs|style|refactor|chore|perf|security|config|revert|test'

# "type: Capitalised sentence with a full stop." No scopes; the history uses
# none.
SUBJECT_RE="^($TYPES): [A-Z].*\.$"

ATTRIBUTION_RE='^[[:space:]]*co-authored-by:.*(claude|anthropic)|generated with \[?claude code'

DEPENDABOT='49699333+dependabot[bot]@users.noreply.github.com'

commits=$(git rev-list --no-merges "$RANGE")

if [ -z "$commits" ]; then
  echo "Commits: no non-merge commits in $RANGE."
  exit 0
fi

failed=0
skipped=0

for sha in $commits; do
  if [ "$(git log -1 --format=%ae "$sha")" = "$DEPENDABOT" ]; then
    skipped=$((skipped + 1))
    continue
  fi

  short=$(git rev-parse --short "$sha")
  subject=$(git log -1 --format=%s "$sha")
  message=$(git log -1 --format=%B "$sha")

  if ! printf '%s\n' "$subject" | grep -qE "$SUBJECT_RE"; then
    echo "$short  subject is not 'type: Sentence.'   $subject"
    failed=1
  fi

  if ! printf '%s\n' "$message" | grep -qiE '^signed-off-by: .+'; then
    echo "$short  no Signed-off-by, commit with -s   $subject"
    failed=1
  fi

  if printf '%s\n' "$message" | grep -qiE "$ATTRIBUTION_RE"; then
    echo "$short  carries AI attribution             $subject"
    failed=1
  fi
done

count=$(($(printf '%s\n' "$commits" | wc -l | tr -d ' ') - skipped))

if [ "$failed" -ne 0 ]; then
  echo
  echo "Allowed types: $TYPES"
  echo "Format: 'type: Full sentence with a full stop.', signed off with -s."
  exit 1
fi

if [ "$skipped" -gt 0 ]; then
  echo "Commits: $count checked in $RANGE, all conform; $skipped from Dependabot skipped."
else
  echo "Commits: $count checked in $RANGE, all conform."
fi
