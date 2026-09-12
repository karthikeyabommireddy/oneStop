#!/usr/bin/env bash
# Stop hook - refresh the knowledge graph once, at the end of a turn that changed code.
#
# `graphify update` re-extracts with no LLM call and completes in about a second on a
# small repo, so a once-per-turn refresh keeps the graph accurate without being felt.
# If nothing changed, this exits immediately.
#
# Never fails the turn: a broken graph degrades onestop to reading files, which is
# slower but still correct.

set -uo pipefail

[ -s .onestop/kg-dirty ] || exit 0
command -v graphify >/dev/null 2>&1 || exit 0
[ -f graphify-out/graph.json ] || exit 0

count=$(wc -l < .onestop/kg-dirty | tr -d ' ')

if graphify update . >/dev/null 2>&1; then
  : > .onestop/kg-dirty
  echo "knowledge graph refreshed after $count changed file(s)"
else
  echo "knowledge graph refresh failed - phases will read files directly until it is rebuilt" >&2
fi
exit 0
