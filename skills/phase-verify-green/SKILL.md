---
name: phase-verify-green
description: Prove the existing suite is green and actually covers the code about to be restructured, before a refactor begins. Adds characterization tests where coverage is missing. Loaded by the orchestrate skill for refactor intent.
version: 1.0.0
user-invocable: false
metadata:
  origin: onestop
  phase: verify-green
---

# Phase - Verify Green

A refactor is only safe if something proves behavior did not change. This phase
establishes that proof before a single line moves.

## Procedure

**1. Run the full suite.** It must be green *before* anything is touched. If it is
already red, stop - report the failures. Refactoring on a red suite makes it
impossible to tell what the refactor broke.

**2. Measure coverage of the target code specifically** - not the repo average. The
files about to be restructured are what matter.

**3. Judge the safety net.** For each behavior the target code provides, is there a
test that would fail if that behavior changed? Coverage percentage is a weak proxy:
a line executed by a test with no meaningful assertion is uncovered in every way that
matters here. Read the tests, do not just read the number.

**4. Add characterization tests for the gaps.** Where behavior is unprotected, write
tests that capture what the code does **today** - including behavior that looks wrong.
A characterization test documents current reality; correcting behavior is a separate
change with its own intent, and mixing the two makes both unreviewable.

**5. Re-run and confirm green.** This is the baseline every later step is checked
against.

## Output

```
VERIFY GREEN
  suite:      <pass/fail counts, and the command>
  target:     <files to be restructured>
  coverage:   <line and branch, for the target>
  net:        adequate | gaps found
  added:      <n> characterization tests, at <paths>
  quirks:     <behavior captured that looks wrong - flag, do not fix here>
  baseline:   green as of <commit>
```

## Rules

1. **Never refactor on a red suite.**
2. **Never refactor untested code.** Add characterization tests first.
3. **Characterization tests capture today behavior**, bugs included. Do not correct
   behavior in this phase.
4. **Coverage numbers are not a safety net.** Read the assertions.
5. **Report quirks, do not fix them.** They are a separate change.
