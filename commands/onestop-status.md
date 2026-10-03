---
description: Show where the current onestop run stands.
allowed-tools: mcp__plugin_onestop_engine__run_status
---

Call the onestop engine's `run_status` with `events: 5`. Change nothing and start nothing.

- No run: say so in one line, and suggest `/onestop <request>`.
- The ledger is unreadable: report the error, and suggest `/onestop-resume`, which offers
  to archive it.

Otherwise report exactly this, filled from the result:

```
onestop  <run_id>  <status>
  request:   <request>
  intent:    <intent>   tier: <tier>   gate mode: <gate_mode>
  progress:  <progress>
  now:       <current phase, or the gate awaiting an answer>
  authorises implementation: <authorising_phase> gate
  open:      <each unresolved open question with its recommended answer, or none>
  blocked:   <blocked_reason, or nothing>
  recent:    <the last few events, one line each>
```

Progress marks: ✓ done · ⤼ skipped · ▶ active · ⏸ awaiting its gate · ✗ blocked · · to come.
