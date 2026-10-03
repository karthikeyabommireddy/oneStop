# The development loop (implement)

Read when the implement recipe names this guide. `recipe.roles` names who does each step.
The engine checkpoints on its own; add `checkpoint` with `slice <n>` after each wave.

1. Dispatch `work-partitioner` with the plan; pass its tasks to `schedule_waves`.
2. For each wave, one step at a time, every lane of the wave in one message per step:
   red (`roles.red` writes the failing test) -> code (`roles.code` makes it pass inside its
   write surface, running the resolved build and test) -> review (`roles.review` on that
   module's diff). When `roles.red` is null (docs, upgrade), skip red: the existing suite is
   the signal, and the code step must return it to green.
3. A failing build, test or review finding: call `loop_attempt` first. Allowed - dispatch the
   fix (`build-resolver` for a build, the coder for a test or finding) and repeat the step.
   Not allowed - stop and present the blocked gate (see the gates guide).
4. Join each wave through `merge-coordinator` (the full suite on the combined state), then
   `checkpoint` with `slice <n>`.
