#!/bin/sh
#
# Checks the deployed site against this repository, and fails on any
# difference. A manual post-deploy command, deliberately not part of CI.
#
# The test suite reads dist/, but Cloudflare's dashboard can change what ships
# without dist/ changing at all: five such changes were found on 2026-09-11,
# three of them by accident, and README > Dashboard settings the site depends
# on lists them. Assume there is a sixth. That is why the body rules below
# match a string anywhere in the response rather than inside a tag shape
# decided in advance: the grep that missed JavaScript Detections matched
# `cdn-cgi` only inside script attributes.
#
# What fails, per response:
#
#   1. Any header public/_headers sets for that path whose production value
#      differs, with both values printed. The expected values are parsed out
#      of the file, every matching rule applied and a repeated name joined
#      with a comma the way Pages does it, so this cannot drift from the file
#      it guards. Headers the file does not set are not compared; Cloudflare
#      adds several.
#   2. `cdn-cgi` anywhere in the body. That namespace is where Cloudflare puts
#      whatever it injects, so the rule is absolute, with no exceptions. It
#      matches the bare word so that an escaped `\/cdn-cgi\/` is caught too.
#   3. `__cf_email__` or `email-protection` anywhere in the body.
#   4. A script, stylesheet, image, frame or media element that fetches from
#      another origin. It is the element list tests/privacy.spec.ts checks in
#      the build, so this is the deployed half of "No third-party requests".
#      The site's own origin is `site` in astro.config.mjs.
#   5. An inline <script> or <style> whose sha256 is not in the CSP that
#      public/_headers sends for that path, which means the build did not
#      write it. JSON-LD is exempt: it never executes and script-src does not
#      govern it.
#   6. A status other than the one expected: 200, or 404 for a path that has
#      no page.
#
# Not caught: a change to the text of a file. Managed robots.txt, which the
# edge served until 2026-09-11, added no script, no cdn-cgi and no header, so
# no rule above saw it; it was found by reading the file.
#
# Known failure, expected as of 2026-09-11: rules 2 and 5 fail on every HTML
# response. JavaScript Detections injects an inline script that loads
# /cdn-cgi/challenge-platform/scripts/jsd/main.js, Bot Fight Mode is off, and
# no dashboard setting was found that removes it. The CSP blocks the script,
# at one console error per page. The rules are not relaxed to fit it: a check
# that learns to ignore one injection is a check that ignores the next.
#
# Verified not to be vacuous on 2026-09-11, against https://sinduri.lol:
# reverting the HSTS value in public/_headers made rule 1 fail on every
# response; appending a beacon <script>, an email-protection link with a
# __cf_email__ span, a cross-origin <img> and an unhashed <style> to each body
# made rules 2 to 5 each fire and name the snippet; restoring both files
# returned the run to the known failures above. A preview deployment outside
# the zone, which gets none of its settings, passed with exit 0, which is what
# production should report once JavaScript Detections stops injecting.
#
# Rule 5 had never fired until the parser was fixed; see the note on
# elements.awk below.
#
# Run it after any deploy that changes public/_headers, and after any change in
# the Cloudflare dashboard. It is not in CI because CI runs before the deploy,
# so nothing live corresponds to the change under test yet, and a job depending
# on the network and on Cloudflare would fail for unrelated reasons.
#
# Usage: sh scripts/check-live.sh [origin]    (default: `site` in astro.config.mjs)
# Exit:  0 production matches, 1 it does not, 2 the check could not run.

set -eu

cd "$(dirname "$0")/.."

CONFIG=astro.config.mjs
HEADERS_FILE=public/_headers

# The one real post, chosen because it will outlive the lorem ipsum ones. If it
# is ever renamed, this path returns 404 and rule 6 says so.
POST_PATH=/blog/open-source-is-not-just-code/
UNKNOWN_PATH=/check-live-no-such-page/
TIMEOUT_SECONDS=20

# A browser's User-Agent and Accept, not curl's. Measured 2026-09-11: the Web
# Analytics beacon was injected into a browser's response and not into one sent
# with curl's defaults, so a check that does not look like a browser can miss
# what a reader receives.
USER_AGENT='Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36'
ACCEPT='text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'

TAB=$(printf '\t')
FAILURES=0
RESPONSES=0

die() {
  echo "check-live: $*" >&2
  exit 2
}

for tool in curl awk sed grep tr cut openssl base64 mktemp; do
  command -v "$tool" >/dev/null 2>&1 || die "needs $tool, which is not installed"
done

SITE=$(sed -n "s/^[[:space:]]*site:[[:space:]]*['\"]\([^'\"]*\)['\"].*/\1/p" "$CONFIG" | head -n 1)
SITE=${SITE%/}
case "$SITE" in
  https://*/*) die "\`site\` in $CONFIG has a path; only an origin is supported" ;;
  https://?*) ;;
  *) die "no https \`site\` found in $CONFIG" ;;
esac

TARGET=${1:-$SITE}
TARGET=${TARGET%/}
case "$TARGET" in
  https://*/*) die "pass an origin, not a URL with a path: $TARGET" ;;
  https://?*) ;;
  *) die "the origin must be https: $TARGET" ;;
esac

TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
trap 'exit 2' INT TERM

# Unique per run, so no edge cache can answer with a copy from before a
# dashboard change. Sent with `Cache-Control: no-cache` for the same reason.
CACHE_BUST="check-live=$(date +%s)-$$"

# public/_headers as `pattern<TAB>name<TAB>value` lines, in file order. The
# same grammar tests/headers.spec.ts parses: `#` comments, an unindented
# pattern, indented `Name: value` lines under it.
cat > "$TMP/rules.awk" <<'AWK'
{
  line = $0
  sub(/#.*/, "", line)
  sub(/[ \t\r]+$/, "", line)
}
line ~ /^[ \t]*$/ { next }
line !~ /^[ \t]/ { pattern = line; next }
{
  if (pattern == "") {
    print "a header line comes before any pattern: " $0 > "/dev/stderr"
    exit 2
  }
  i = index(line, ":")
  if (i == 0) {
    print "neither a pattern nor a header: " $0 > "/dev/stderr"
    exit 2
  }
  name = substr(line, 1, i - 1)
  value = substr(line, i + 1)
  gsub(/^[ \t]+|[ \t]+$/, "", name)
  gsub(/^[ \t]+|[ \t]+$/, "", value)
  printf "%s\t%s\t%s\n", pattern, tolower(name), value
}
AWK

# Walks an HTML body tag by tag. For every fetching element it prints
# `ref<TAB>tag<TAB>attribute<TAB>url`; for every inline <script> or <style> it
# writes the body, byte for byte, to OUT.<tag>.<n>.body and prints
# `inline<TAB>tag<TAB>n<TAB>type`. A <script> or <style> body and an HTML
# comment are each skipped whole, so markup inside them is never read as a tag.
# Skipping comments is load-bearing: one that mentions `<style>` otherwise
# stops the scan looking for a `</style>` that never comes, and everything
# after it goes unchecked while the floors below still pass, because the <head>
# has already been read.
#
# It prints `complete` only if it reaches the end of the document, and the
# caller fails without it.
cat > "$TMP/elements.awk" <<'AWK'
BEGIN {
  OFS = "\t"
  split("script link img iframe video audio source embed object track", t, " ")
  for (k in t) FETCHING[t[k]] = 1
  NATTRS = split("src href data poster", ATTRS, " ")
  ABSENT = "\001"
}
function attr(a, name,    la, v, q) {
  la = tolower(a)
  if (!match(la, "(^|[ \t\n\r/])" name "[ \t\n\r]*=")) return ABSENT
  v = substr(a, RSTART + RLENGTH)
  sub(/^[ \t\n\r]+/, "", v)
  q = substr(v, 1, 1)
  if (q == "\"" || q == "'") {
    v = substr(v, 2)
    return substr(v, 1, index(v, q) - 1)
  }
  match(v, /^[^ \t\n\r>]*/)
  return substr(v, 1, RLENGTH)
}
{ doc = doc (NR > 1 ? "\n" : "") $0 }
END {
  low = tolower(doc)
  pos = 1
  while ((i = index(substr(low, pos), "<")) > 0) {
    start = pos + i - 1
    if (substr(low, start, 4) == "<!--") {
      end_at = index(substr(low, start + 4), "-->")
      if (end_at == 0) { print "truncated", "!--", start, "-"; exit }
      pos = start + end_at + 6
      continue
    }
    if (!match(substr(low, start + 1), /^[a-z][a-z0-9-]*/)) { pos = start + 1; continue }
    name = substr(low, start + 1, RLENGTH)
    gt = index(substr(doc, start), ">")
    if (gt == 0) { print "truncated", name, start, "-"; exit }
    gt += start - 1
    attrs = substr(doc, start + 1 + length(name), gt - start - 1 - length(name))
    pos = gt + 1

    src = attr(attrs, "src")
    if (name in FETCHING) {
      for (k = 1; k <= NATTRS; k++) {
        if (name == "script" && ATTRS[k] != "src") continue
        v = attr(attrs, ATTRS[k])
        if (v != ABSENT) print "ref", name, ATTRS[k], v
      }
    }

    if (name != "script" && name != "style") continue
    close_at = index(substr(low, gt + 1), "</" name)
    if (close_at == 0) { print "truncated", name, start, "-"; exit }
    close_at += gt
    pos = close_at + 1
    if (name == "script" && src != ABSENT) continue

    n[name]++
    file = OUT "." name "." n[name] ".body"
    printf "%s", substr(doc, gt + 1, close_at - gt - 1) > file
    close(file)
    type = attr(attrs, "type")
    if (type == ABSENT || type == "") type = "-"
    print "inline", name, n[name], tolower(type)
  }
  print "complete", "-", "-", "-"
}
AWK

awk -f "$TMP/rules.awk" "$HEADERS_FILE" > "$TMP/rules" ||
  die "could not parse $HEADERS_FILE"
[ -s "$TMP/rules" ] || die "$HEADERS_FILE sets no headers"
if cut -f1 "$TMP/rules" | grep -q ':'; then
  die "a pattern in $HEADERS_FILE uses a placeholder, which this script does not implement. Extend it in the same commit."
fi

fail() {
  FAILURES=$((FAILURES + 1))
  printf 'FAIL  %s  %s\n' "$1" "$2"
}

detail() {
  printf '        %s\n' "$1"
}

# The headers Pages sends for a path, as `name<TAB>value`: every matching rule
# applies, and a name set by more than one of them is joined with a comma.
expected_for() {
  while IFS="$TAB" read -r pattern name value; do
    # Unquoted on purpose: the pattern is a glob, and in `case` a `*` matches
    # across `/`, which is how Pages matches `/*` and `/_astro/*`.
    # shellcheck disable=SC2254
    case "$1" in $pattern) printf '%s\t%s\n' "$name" "$value" ;; esac
  done < "$TMP/rules" | awk -F "$TAB" '
    { if ($1 in v) v[$1] = v[$1] ", " $2; else { v[$1] = $2; order[++n] = $1 } }
    END { for (i = 1; i <= n; i++) printf "%s\t%s\n", order[i], v[order[i]] }'
}

# A response header's value, repeated lines joined with a comma. Exits 1 when
# the header was not sent at all.
live_header() {
  awk -v want="$1" '
    { name = $0; sub(/:.*/, "", name) }
    tolower(name) != want || index($0, ":") == 0 { next }
    {
      value = $0
      sub(/^[^:]*:[ \t]*/, "", value)
      sub(/[ \t]+$/, "", value)
      out = found ? out ", " value : value
      found = 1
    }
    END { if (!found) exit 1; print out }' "$2"
}

same_origin() {
  case "$1" in
    "$SITE" | "$SITE"/* | "$TARGET" | "$TARGET"/*) return 0 ;;
    //*) return 1 ;;
  esac
  # A colon before the first slash is a scheme: another origin, or data:.
  case "${1%%/*}" in *:*) return 1 ;; esac
  return 0
}

sha256() {
  openssl dgst -sha256 -binary "$1" | base64 | tr -d '\n'
}

# The sha256 sources in one CSP directive, without the quotes or the prefix.
directive_hashes() {
  printf '%s\n' "$2" | tr ';' '\n' |
    sed -n "s/^[[:space:]]*$1[[:space:]]//p" |
    grep -o "'sha256-[A-Za-z0-9+/=]*'" |
    sed "s/^'sha256-//; s/'\$//" || true
}

check_headers() {
  expected_for "$1" > "$TMP/expected"
  while IFS="$TAB" read -r name want; do
    if got=$(live_header "$name" "$2"); then
      [ "$got" = "$want" ] && continue
      fail "$1" "$name differs from public/_headers"
    else
      got='(not sent)'
      fail "$1" "$name is not sent"
    fi
    detail "public/_headers: $want"
    detail "production:      $got"
  done < "$TMP/expected"
}

check_strings() {
  for needle in cdn-cgi __cf_email__ email-protection; do
    grep -qF -- "$needle" "$2" || continue
    fail "$1" "\`$needle\` in the body, $(grep -oF -- "$needle" "$2" | wc -l | tr -d ' ') time(s)"
    LC_ALL=C grep -o ".\{0,50\}$needle.\{0,70\}" "$2" | head -n 3 |
      while IFS= read -r context; do detail "$context"; done
  done
}

check_elements() {
  LC_ALL=C awk -v OUT="$2" -f "$TMP/elements.awk" "$2.body" > "$2.index" || true
  csp=$(awk -F "$TAB" '$1 == "content-security-policy" { print $2 }' "$TMP/expected")
  script_hashes=$(directive_hashes script-src "$csp")
  style_hashes=$(directive_hashes style-src "$csp")
  refs=0
  inlines=0
  complete=0
  truncated=0

  while IFS="$TAB" read -r kind tag key value; do
    case "$kind" in
      complete)
        complete=1
        continue
        ;;
      truncated)
        truncated=1
        fail "$1" "the element scan stopped at byte $key, at an unterminated <$tag>, so nothing after it was checked"
        continue
        ;;
    esac

    if [ "$kind" = ref ]; then
      refs=$((refs + 1))
      same_origin "$value" && continue
      fail "$1" "<$tag> fetches from another origin"
      detail "$key=\"$value\""
      continue
    fi

    inlines=$((inlines + 1))
    [ "$value" = application/ld+json ] && continue
    block="$2.$tag.$key.body"
    hash=$(sha256 "$block")
    if [ "$tag" = script ]; then
      allowed=$script_hashes directive=script-src
    else
      allowed=$style_hashes directive=style-src
    fi
    printf '%s\n' "$allowed" | grep -qxF -- "$hash" && continue
    fail "$1" "inline <$tag> the build did not write: its hash is not in $directive"
    detail "sha256-$hash"
    detail "$(tr '\n' ' ' < "$block" | cut -c1-120)"
  done < "$2.index"

  # A scan that stopped early has checked only part of the page, and must not
  # pass on the part it saw.
  [ "$complete" -eq 1 ] || [ "$truncated" -eq 1 ] ||
    fail "$1" "the element scan did not finish, so the page was not fully checked"

  # Floors, so a parser that matches nothing cannot pass by finding nothing.
  # Every page loads the stylesheet and carries Astro's inline island loader.
  [ "$refs" -gt 0 ] ||
    fail "$1" "no fetching element was found; the parser matched nothing"
  [ "$inlines" -gt 0 ] ||
    fail "$1" "no inline <script> or <style> was found; the parser matched nothing"
}

# $1 path, $2 expected status. Leaves the body at $LAST_BODY.
check_response() {
  RESPONSES=$((RESPONSES + 1))
  out="$TMP/r$RESPONSES"
  url="$TARGET$1"
  case "$1" in *\?*) query="&$CACHE_BUST" ;; *) query="?$CACHE_BUST" ;; esac

  status=$(curl --silent --show-error --max-time "$TIMEOUT_SECONDS" \
    --user-agent "$USER_AGENT" --header "Accept: $ACCEPT" \
    --header 'Cache-Control: no-cache' \
    --dump-header "$out.raw" --output "$out.body" \
    --write-out '%{http_code}' "$url$query") || die "could not fetch $url"
  tr -d '\r' < "$out.raw" > "$out.head"
  LAST_BODY="$out.body"
  before=$FAILURES

  if [ "$status" != "$2" ]; then
    fail "$1" "status $status, expected $2"
    location=$(live_header location "$out.head" || true)
    [ -z "$location" ] || detail "location: $location"
  fi

  check_headers "$1" "$out.head"
  check_strings "$1" "$out.body"

  content_type=$(live_header content-type "$out.head" || true)
  case "$content_type" in text/html*) check_elements "$1" "$out" ;; esac

  [ "$FAILURES" -ne "$before" ] || printf 'ok    %s\n' "$1"
}

echo "check-live: $TARGET against $HEADERS_FILE"

check_response / 200
ASSET=$(grep -o '/_astro/[A-Za-z0-9._-]*\.css' "$LAST_BODY" | head -n 1 || true)
[ -n "$ASSET" ] ||
  ASSET=$(grep -o '/_astro/[A-Za-z0-9._-]*' "$LAST_BODY" | head -n 1 || true)

check_response /privacy/ 200
check_response "$POST_PATH" 200

if [ -n "$ASSET" ]; then
  check_response "$ASSET" 200
else
  fail / "the homepage references nothing under /_astro/, so no hashed asset was checked"
fi

check_response "$UNKNOWN_PATH" 404

if [ "$FAILURES" -gt 0 ]; then
  echo
  echo "check-live: $FAILURES divergence(s) between $TARGET and this repository, over $RESPONSES responses."
  exit 1
fi

echo "check-live: $RESPONSES responses match this repository."
