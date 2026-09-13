#!/bin/sh
#
# Compares the vendored Umami tracker with the one Umami serves today, and
# fails on any difference. A manual command, deliberately not part of CI.
#
# public/vendor/umami.js is a byte-identical copy, so nothing updates it and
# nothing notices when it falls behind: an old tracker against a newer API
# fails as a dashboard that quietly stops counting. src/lib/analytics.ts says
# why it is vendored. Run this at least monthly, and after any Umami changelog
# entry that mentions the tracker.
#
# On a difference, the new bytes are left in tmp/, outside public/ so a build
# cannot ship them, and the diff is printed. Before replacing the copy, read
# that diff for new storage, new hosts, new data sent and new `data-*`
# settings, and update /privacy, tests/analytics.spec.ts and UMAMI_VENDORED_ON
# in the same commit.
# docs/DEPLOYMENT.md > Umami has the steps.
#
# It is not in CI because it depends on the network and on a third party, and
# a job failing for Umami's release schedule would fail unrelated pull requests.
#
# Usage: sh scripts/check-umami.sh
# Exit:  0 the copy matches, 1 it does not, 2 the check could not run.

set -eu

cd "$(dirname "$0")/.."

ANALYTICS=src/lib/analytics.ts
VENDORED=public/vendor/umami.js
TIMEOUT_SECONDS=20

die() {
  echo "check-umami: $*" >&2
  exit 2
}

for tool in curl cmp sed mktemp; do
  command -v "$tool" >/dev/null 2>&1 || die "needs $tool, which is not installed"
done

[ -f "$VENDORED" ] || die "$VENDORED is missing"

UPSTREAM=$(sed -n "s/^export const UMAMI_UPSTREAM_SCRIPT = '\([^']*\)';$/\1/p" "$ANALYTICS")
case "$UPSTREAM" in
  https://?*) ;;
  *) die "no https UMAMI_UPSTREAM_SCRIPT found in $ANALYTICS" ;;
esac

VENDORED_ON=$(sed -n "s/^export const UMAMI_VENDORED_ON = '\([^']*\)';$/\1/p" "$ANALYTICS")

LATEST=tmp/umami-upstream.js
TMP=$(mktemp)
trap 'rm -f "$TMP"' EXIT

curl --silent --show-error --fail --location --max-time "$TIMEOUT_SECONDS" \
  --output "$TMP" "$UPSTREAM" || die "could not fetch $UPSTREAM"

[ -s "$TMP" ] || die "$UPSTREAM returned an empty body"

if cmp -s "$TMP" "$VENDORED"; then
  rm -f "$LATEST"
  echo "check-umami: $VENDORED matches $UPSTREAM (vendored ${VENDORED_ON:-on an unrecorded date})"
  exit 0
fi

mkdir -p "$(dirname "$LATEST")"
cp "$TMP" "$LATEST"
echo "check-umami: $VENDORED differs from $UPSTREAM (vendored ${VENDORED_ON:-on an unrecorded date})"
echo "check-umami: the upstream bytes are in $LATEST. Review, then replace the copy with them."
diff "$VENDORED" "$LATEST" || true
exit 1
