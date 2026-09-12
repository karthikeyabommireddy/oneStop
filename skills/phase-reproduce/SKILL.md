---
name: phase-reproduce
description: Turn a reported defect into a failing regression test that fails for the right reason, before any fix is attempted. Loaded by the orchestrate skill for defect intent; not usually invoked directly.
version: 1.0.0
user-invocable: false
metadata:
  origin: onestop
  phase: reproduce
---

# Phase - Reproduce

A bug that was never reproduced was never fixed - it was only made to stop appearing.
This phase produces the proof.

## Procedure

**1. Establish the expected behavior.** State what should happen, in observable terms.
If the report does not say, derive it from the spec, the tests, or the surrounding
code. If it genuinely cannot be derived, that is missing information and the one
question this phase may ask.

**2. Establish the actual behavior.** Run the path. Capture the real output, error, or
stack trace. Do not work from the report wording alone - reports are often imprecise
about which layer fails.

**3. Narrow to the smallest trigger.** Strip the reproduction to the minimum input and
state that still produces it. The narrowing itself usually reveals the cause.

**4. Write the failing test.** At the lowest level that captures the defect - a unit
test if the fault is in one function, an integration test if it emerges from an
interaction, an end-to-end test only if it is genuinely a journey-level failure.

**5. Verify the failure is real.** Run it. It must fail, and the failure message must
describe the actual defect. A test that fails on a typo, a missing import, or a
misconfigured fixture proves nothing. Confirm the reason, not just the red.

**6. Locate the cause.** Only now trace to the root. Distinguish the cause from the
symptom - fixing where the error surfaced rather than where it originated leaves the
bug in place under a different name.

## Cannot Reproduce

If it will not reproduce, say so and report precisely what was tried: the paths, the
inputs, the environment. Then name the most likely missing conditions - version,
data state, timing, concurrency, environment config - and ask for exactly those.
That is genuinely missing information.

**Never** fix a defect you could not reproduce. Without a failing test there is no
evidence the change fixed anything, and no protection against regression.

## Output

```
REPRODUCE
  expected:  <observable behavior>
  actual:    <observable behavior, with the real output>
  trigger:   <minimal input and state>
  test:      <path:line of the new failing test>
  failure:   <the assertion message, proving it fails for the right reason>
  cause:     <root cause, with path:line - distinct from where it surfaced>
  scope:     <anything else the same cause affects>
```

## Rules

1. **No fix before a failing test.** The test is the evidence.
2. **The test must fail for the right reason.** Verify the message.
3. **Never delete the regression test after the fix.** It is the guard.
4. **Fix the cause, not the symptom.**
5. **Never claim a reproduction that did not happen.** Report the gap and what is
   needed to close it.
