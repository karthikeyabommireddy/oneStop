# Gates - the unusual cases

Read when a gate result is not a plain approve.

- **Expand at plan and ship.** At those two gates, list every phase's outcome, not one line.
- **Adjust first.** Record the user's words with `run_note` (`kind: "amendment"`) and present
  the gate again so they confirm the amended direction.
- **`needs_confirmation`** (skipping review after a security surface, or tests after a
  behaviour change): show the warning, ask once more, and pass `confirmed: true` only if the
  user still skips.
- **Approvals.** When the user approves a dependency, a version or a tool, record it with
  `run_note` (`kind: "approval"`, `approval_kind: "dependency"` or `"tool"`,
  `item: "npm:zod@3.23.8"`). The guard lets only approved installs run.
- **Open questions.** Every `open_questions` item goes in DECIDE with its recommended answer;
  record each answer with `run_note` (`kind: "resolve"`) before `gate_record`.
- **Blocked phase** (a retry budget ran out): show the last real error and every approach
  tried. Options: try another approach (`adjusted`, which allows one more round) | accept and
  move on (`approved`) | stop.
- **Stop here.** `gate_record` with `stopped`, then `run_close` with `stopped`, and say exactly
  what exists and what does not.
