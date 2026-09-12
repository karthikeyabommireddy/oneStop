---
description: Resume the active onestop run from its first incomplete phase, restoring the intent, bound specialists and decisions from the run ledger.
argument-hint: "[optional: a correction or new constraint to apply before resuming]"
allowed-tools: Read, Write, Edit, Bash, Grep, Glob, Task
---

Resume the active onestop run.

1. Read `.onestop/run.json`. If it is missing or its status is `complete`, say so and
   stop - suggest `/onestop <request>` to start a new run.

2. Restore the run state without re-deriving it: the intent, the tier, the bound
   specialists, the decisions already made, and the phase progress. **Do not re-run
   discovery for units already searched**, and do not re-ask a question the ledger
   records as answered - that is the entire purpose of the ledger.

3. Re-acquire only what could have changed since the run paused: the working tree
   state, the current diff, and whether the suite is still green. If the tree moved
   under the run - new commits, changed files in the change surface - say so and
   reconcile before continuing.

4. If `$ARGUMENTS` carries a correction or new constraint, apply it to the remaining
   plan before resuming, and record it in the ledger as an amendment.

5. Invoke the `orchestrate` skill, entering at the first incomplete phase. Honour any
   gate the ledger shows as pending - a resumed run does not skip a gate that was
   never approved.

State in one line where you are resuming from and why, then continue.
