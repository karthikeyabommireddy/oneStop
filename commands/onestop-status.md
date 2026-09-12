---
description: Show the current onestop run - intent, tier, phase progress, decisions made, open questions, and gate state.
allowed-tools: Read, Bash, Glob
---

Read `.onestop/run.json` in the current repository and report the run state.

If no run ledger exists, say so in one line and stop - do not start a run.

Report exactly this:

```
RUN <run_id>   status: <active | complete | blocked>
  request: <the original request>
  intent:  <intent>        tier: <tier>

PHASES
  <phase>  <done | active | pending | skipped>   <one-line result if done>

STEPS
  <n>. <title>  <status>  <decision taken, and its evidence>

DECISIONS
  <choices resolved without asking, each with the rule that settled it>

OPEN
  <questions waiting on the user, or none>

GATES
  gate 1 (plan): <approved | pending | not reached>
  gate 2 (ship): <approved | pending | not reached>
```

Then state in one line what happens next if the user says continue.

Do not modify the ledger. Do not resume the run. This command is read-only.
