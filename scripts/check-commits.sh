#!/bin/sh
#
# Checks every non-merge commit in a range against the conventions in
# CLAUDE.md: the subject format, the sign-off, and the absence of AI
# attribution.
#
# .githooks/commit-msg already strips attribution as commits are written, but
# hooks are not cloned and `git config core.hooksPath .githooks` is opt-in, so
# a clone that never ran that command has no protection at all. This runs in
# CI, where opting out is not possible.
#
# Merge commits are skipped. GitHub writes "Merge pull request #N from ..."
# itself and signs off nothing, so every merge in this repository's history
# would fail all three checks. They are not authored here and are not ours to
# format.
#
# Usage: sh scripts/check-commits.sh [range]     (default origin/main..HEAD)

set -eu

RANGE=${1:-origin/main..HEAD}

# From CLAUDE.md. `test` is included: the repository has used it four times
# for genuine test-only commits, and the list there had simply omitted it.
TYPES='feat|fix|docs|style|refactor|chore|perf|security|config|revert|test'

# "type: Capitalised sentence with a full stop." No scopes, because nothing in
# this repository's history uses one.
SUBJECT_RE="^($TYPES): [A-Z].*\.$"

ATTRIBUTION_RE='^[[:space:]]*co-authored-by:.*(claude|anthropic)|generated with \[?claude code'

commits=$(git rev-list --no-merges "$RANGE")

if [ -z "$commits" ]; then
  echo "Commits: no non-merge commits in $RANGE."
  exit 0
fi

failed=0

for sha in $commits; do
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

count=$(printf '%s\n' "$commits" | wc -l | tr -d ' ')

if [ "$failed" -ne 0 ]; then
  echo
  echo "Allowed types: $TYPES"
  echo "Format: 'type: Full sentence with a full stop.', signed off with -s."
  exit 1
fi

echo "Commits: $count checked in $RANGE, all conform."
