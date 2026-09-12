#!/usr/bin/env bash
# PostToolUse hook - record that a file changed, without paying for a rebuild yet.
#
# Refreshing the graph after every single edit would run it many times per turn for
# no benefit. Instead each edit appends its path here, and the Stop hook does ONE
# refresh at the end of the turn. Marking is a single append, so it costs nothing.
#
# Reads the tool payload as JSON on stdin; never fails the tool call.

set -uo pipefail

payload="$(cat 2>/dev/null || true)"

# Pull the edited path out of the payload without requiring jq to be installed.
path="$(printf '%s' "$payload" \
  | grep -oE '"file_path"[[:space:]]*:[[:space:]]*"[^"]+"' \
  | head -1 | sed 's/.*"\([^"]*\)"$/\1/')"

[ -z "$path" ] && exit 0

# Only source changes matter to the graph. Docs, lockfiles and config do not move it.
case "$path" in
  *.py|*.ts|*.tsx|*.js|*.jsx|*.mjs|*.go|*.rs|*.java|*.kt|*.kts|*.swift|*.dart\
  |*.cs|*.fs|*.cpp|*.cc|*.hpp|*.h|*.c|*.php|*.rb|*.vue|*.svelte|*.sql) ;;
  *) exit 0 ;;
esac

mkdir -p .onestop 2>/dev/null || exit 0
printf '%s\n' "$path" >> .onestop/kg-dirty 2>/dev/null || true
exit 0
