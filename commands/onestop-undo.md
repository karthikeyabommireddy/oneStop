---
description: Undo the onestop run's last change, or the whole run, after a preview.
argument-hint: "[last | whole-run]"
allowed-tools: AskUserQuestion, mcp__plugin_onestop_engine__run_status, mcp__plugin_onestop_engine__checkpoint_revert
---

Undo onestop's changes, two steps, never one.

1. Scope: `whole-run` if `$ARGUMENTS` says so (whole, all, everything, the run), otherwise
   `last` - the most recent phase or slice that changed files.
2. Call the engine's `checkpoint_revert` with that `scope` and no `confirm`. This only
   previews. If it fails - no run, not a git repository, nothing checkpointed yet - say
   why in one line and stop.
3. Show the user:
   - what is undone (`undoes`) and the files it changes (`changes`)
   - if `left_alone` is present: those changes were made after the last checkpoint - by you
     or by work the run has not finished - and the undo does not touch them
4. Ask with AskUserQuestion: Reverse it · Cancel. Recommend Cancel if `left_alone` lists a
   file that also appears in `changes`.
5. Only on "Reverse it", call `checkpoint_revert` again with `confirm: true`.
   - Success: list the files reversed, and say the run's ledger records the undo.
   - Refused because the files changed since the checkpoint: nothing was modified. Say so,
     and that undoing those lines would overwrite newer edits - the user can revert them
     by hand.

Never run git to undo anything yourself - no reset, checkout, restore or stash. The
engine's reverse patch is the only undo, because it changes nothing unless it applies
cleanly.
