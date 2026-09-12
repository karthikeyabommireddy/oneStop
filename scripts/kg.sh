#!/usr/bin/env bash
# onestop knowledge graph - a thin, verified wrapper over graphify.
#
# The point of the graph is that the model stops re-reading the codebase. Build it
# once, refresh it in under a second after every change, and query it for targeted
# context instead of opening files.
#
#   kg.sh status              is a graph present, and how stale
#   kg.sh build               first build + report  (slower, once per repo)
#   kg.sh refresh             incremental re-extract, no LLM  (~1s)
#   kg.sh explain "<node>"    one node, its source location and its edges
#   kg.sh path "<a>" "<b>"    shortest dependency path between two nodes
#   kg.sh report              print the graph report
#   kg.sh ensure              build if missing, refresh if dirty  (used by hooks)
#
# Verified against graphify 0.9.16.

set -uo pipefail

TARGET="${ONESTOP_KG_TARGET:-.}"
OUT="$TARGET/graphify-out"
GRAPH="$OUT/graph.json"
REPORT="$OUT/GRAPH_REPORT.md"
DIRTY="$TARGET/.onestop/kg-dirty"

have_graphify() { command -v graphify >/dev/null 2>&1; }

need_graphify() {
  if ! have_graphify; then
    echo "graphify is not installed."
    echo "Install with:  pip install graphifyy==0.9.16"
    echo "onestop works without it, but every phase will read files directly instead."
    return 1
  fi
  return 0
}

# graphify writes an AST cache under graphify-out/cache/ast/. On Windows a very deep
# repo path overflows MAX_PATH and the cache write fails with an ENOENT on a .tmp file,
# leaving an empty graph. Warn rather than fail - the caller can still fall back.
check_path_depth() {
  local n=${#PWD}
  if [ "$n" -gt 150 ]; then
    echo "warning: repository path is $n characters. graphify AST caching can fail" >&2
    echo "         beyond roughly 150 characters on Windows. If the graph comes back" >&2
    echo "         empty, that is the cause - move the repo to a shorter path." >&2
  fi
}

cmd_status() {
  if ! have_graphify; then echo "graphify: not installed"; return 0; fi
  if [ ! -f "$GRAPH" ]; then echo "graph: absent - run kg.sh build"; return 0; fi
  local nodes
  nodes=$(grep -o '"id"' "$GRAPH" 2>/dev/null | wc -l | tr -d ' ')
  echo "graph:  present  (~$nodes node entries)"
  echo "report: $([ -f "$REPORT" ] && echo present || echo absent)"
  if [ -s "$DIRTY" ]; then
    echo "state:  DIRTY - $(wc -l < "$DIRTY" | tr -d ' ') file(s) changed since last refresh"
  else
    echo "state:  clean"
  fi
}

cmd_build() {
  need_graphify || return 1
  check_path_depth
  echo "Building knowledge graph (first build - this is the slow one)..."
  graphify "$TARGET" || return 1
  # `graphify <path>` writes graph.json but NOT the report; cluster-only produces it.
  # --no-label skips LLM community naming, --no-viz skips the HTML render.
  graphify cluster-only "$TARGET" --no-label --no-viz || return 1
  mkdir -p "$(dirname "$DIRTY")"; : > "$DIRTY"
  grep -qF "graphify-out/" "$TARGET/.gitignore" 2>/dev/null \
    || printf "\n# onestop knowledge graph\ngraphify-out/\n" >> "$TARGET/.gitignore"
  echo "Done. Report: $REPORT"
}

cmd_refresh() {
  need_graphify || return 1
  [ -f "$GRAPH" ] || { cmd_build; return $?; }
  graphify update "$TARGET" >/dev/null 2>&1 || {
    echo "graph refresh failed - falling back to reading files directly" >&2
    return 1
  }
  : > "$DIRTY"
  return 0
}

cmd_ensure() {
  have_graphify || return 0
  if [ ! -f "$GRAPH" ]; then cmd_build; return $?; fi
  [ -s "$DIRTY" ] && cmd_refresh
  return 0
}

cmd_explain() { need_graphify || return 1; graphify explain "$1" --graph "$GRAPH"; }
cmd_path()    { need_graphify || return 1; graphify path "$1" "$2" --graph "$GRAPH"; }
cmd_report()  { [ -f "$REPORT" ] && cat "$REPORT" || echo "no report - run kg.sh build"; }

case "${1:-status}" in
  status)  cmd_status ;;
  build)   cmd_build ;;
  refresh) cmd_refresh ;;
  ensure)  cmd_ensure ;;
  explain) shift; cmd_explain "${1:?node name required}" ;;
  path)    shift; cmd_path "${1:?from required}" "${2:?to required}" ;;
  report)  cmd_report ;;
  *) echo "usage: kg.sh {status|build|refresh|ensure|explain <node>|path <a> <b>|report}"; exit 2 ;;
esac
