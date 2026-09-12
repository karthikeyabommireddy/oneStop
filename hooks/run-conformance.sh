#!/usr/bin/env bash
# Stop hook - report what the run actually did versus what it declared.
#
# Why this exists: in onestop's first real end-to-end run, 5 of 15 phases ran, 0 of 23
# subagents were spawned, the change touched 3 security-trigger surfaces, and security
# review never happened. None of it was noticed at the time, because every phase and
# gate in this plugin is prose in a file and nothing ever checked a run against it.
#
# This does not block anything - blocking a Stop hook on an advisory check would be
# worse than the problem. It makes the gap visible at the turn boundary, which is the
# difference between "silently skipped" and "skipped, and you were told".
#
# Never fails the turn.

set -uo pipefail

LEDGER=".onestop/run.json"
FLAGS=".onestop/security-flags"

[ -d .onestop ] || exit 0

lines=()

# 1. Unreviewed security surfaces - the highest-value signal.
if [ -s "$FLAGS" ]; then
  surfaces=$(cut -f2 "$FLAGS" 2>/dev/null | sort -u)
  files=$(cut -f1 "$FLAGS" 2>/dev/null | sort -u | wc -l | tr -d ' ')
  reviewed="no"
  if [ -f "$LEDGER" ] && grep -qE '"review"[[:space:]]*:[[:space:]]*"(done|complete)"' "$LEDGER" 2>/dev/null; then
    reviewed="yes"
  fi
  if [ "$reviewed" = "no" ]; then
    lines+=("SECURITY REVIEW REQUIRED - $files file(s) touched these surfaces:")
    while IFS= read -r s; do [ -n "$s" ] && lines+=("    - $s"); done <<< "$surfaces"
    lines+=("  registry/intents.json marks security-reviewer MANDATORY for these, at every tier.")
  fi
fi

# 2. Phases that ran with no recorded gate decision. Every phase boundary is a gate
#    (registry/gates.json); a phase marked done with no gate stamp means the user was
#    never shown what ran or asked where to go next. The ledger writes one phase per
#    line, so a per-line scan is enough and avoids fragile multiline matching.
if [ -f "$LEDGER" ]; then
  ungated=$(awk '
    /"status"[[:space:]]*:[[:space:]]*"done"/ && !/"gate"/ {
      if (match($0, /"[a-z][a-z-]*"[[:space:]]*:[[:space:]]*\{/)) {
        name = substr($0, RSTART + 1)
        sub(/".*/, "", name)
        out = (out == "" ? name : out ", " name)
      }
    }
    END { print out }
  ' "$LEDGER" 2>/dev/null)
  if [ -n "$ungated" ]; then
    lines+=("PHASES RAN WITHOUT A GATE - $ungated")
    lines+=("  Every phase boundary should stop and ask (registry/gates.json). These did not.")
  fi
fi

# 3. Run ledger present but phases unstamped.
if [ -f "$LEDGER" ]; then
  if grep -q '"status"[[:space:]]*:[[:space:]]*"active"' "$LEDGER" 2>/dev/null; then
    pending=$(grep -oE '"[a-z-]+"[[:space:]]*:[[:space:]]*"(pending|active)"' "$LEDGER" 2>/dev/null \
      | sed 's/"\([a-z-]*\)".*/\1/' | grep -vE '^(status|gate_1|gate_2)$' | paste -sd, - 2>/dev/null)
    [ -n "$pending" ] && lines+=("RUN INCOMPLETE - phases not yet done: $pending")
  fi
elif [ -s "$FLAGS" ]; then
  # Code was written against security surfaces with no run ledger at all - meaning the
  # orchestrate flow never actually started, it was only narrated.
  lines+=("NO RUN LEDGER - .onestop/run.json was never created, so no phase was tracked.")
  lines+=("  If this was an /onestop run, the orchestrate flow did not actually execute.")
fi

if [ ${#lines[@]} -gt 0 ]; then
  printf '\n[onestop conformance]\n'
  printf '  %s\n' "${lines[@]}"
fi

exit 0
