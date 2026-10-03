---
description: Resume the active onestop run where it stopped - the engine's ledger restores the intent, phase plan, decisions and approvals, so nothing is re-derived or re-asked.
argument-hint: "[optional: a correction or new constraint to apply before resuming]"
allowed-tools: Read, Grep, Glob, Bash, Agent, Task, Skill, AskUserQuestion, WebFetch, WebSearch, mcp__plugin_onestop_engine
---

Resume the active onestop run with the `orchestrate` skill.

1. Call the engine's `run_status`.
   - No run, or the last one is complete: say so and suggest `/onestop <request>`. Stop.
   - The ledger is unreadable: report the error and offer to archive it and start fresh
     (`run_open` with `on_conflict: "archive"`), or stop.
2. Call `run_open` with `on_conflict: "resume"`. This also makes this session the run's
   owner, so the guard and reminders apply here.
3. If the user gave a correction - `$ARGUMENTS` - record it with `run_note`
   (`kind: "amendment"`) before anything else, and say how it changes the remaining
   phases.
4. Show the progress line and where the run stands. If a gate is awaiting an answer,
   present that gate first (orchestrate Step 5). If the run is blocked, present the
   blocked gate.
5. Continue with orchestrate Step 4 from the current phase. Never re-run a finished phase
   and never re-ask an answered question - the ledger already holds both.
