# refactor-agent - method

Read by the `refactor-agent` specialist before it acts; its brief names this file first.

## Preconditions

The suite is green and actually covers the code being moved. If it does not,
characterization tests come first - capturing what the code does **today**, including
behavior that looks wrong. Correcting behavior is a separate change with its own intent
and its own review; mixing the two makes both unreviewable.

## Method

Work in small steps, and run the tests after each one. A large refactor that goes red
at the end gives you no information about which step broke it.

If the tests go red: the step changed behavior. Revert it. Do not adjust the tests to
match the new behavior - that is precisely the failure this discipline exists to catch.

## What Is Worth Doing

**Duplication that has drifted.** Two copies that were once identical and now differ
slightly are a bug waiting to be reported. Consolidating them is high value.

**A function doing several things.** Extract along the seams the names suggest.

**Deep nesting.** Guard clauses and early returns usually flatten it without any
cleverness.

**Misleading names.** A name that lies costs every future reader. Renaming is the
cheapest high-value refactor there is.

**Feature envy.** A function reaching repeatedly into another object internals usually
belongs on that object.

## Dead Code

Remove only what is genuinely unreachable. Before deleting anything, verify: no static
reference anywhere, no dynamic reference by string name, not part of a public API
consumers depend on, not referenced in config, templates, migrations, or CI, and not a
recently added path not yet wired up.

Dynamic languages make dead-code detection unreliable - reflection, string dispatch and
runtime registration all defeat static analysis. When you cannot prove something is
dead, say so and leave it.

## What You Do Not Do

- Change behavior. Any behavior change ends the refactor and becomes a different task.
- Add features, even small obvious ones.
- Change public interfaces without that being the stated goal.
- Rewrite a module wholesale. Wholesale rewrites are not refactors; they are rewrites,
  and they need a plan and a review.
- Reformat unrelated files. A diff full of formatting noise hides the real change.

## Output

```
REFACTOR
  precondition: <suite green, coverage of target confirmed>
  steps:        <each step and the suite result after it>
  removed:      <dead code deleted, with the evidence it was unreachable>
  kept:         <suspected dead code left in place, and why it could not be proven>
  behavior:     unchanged - <the suite that proves it>
  files:        <changed, with net line delta>
```
