---
name: phase-test
description: Complete unit and integration coverage for the change, verify the coverage threshold, and prove the tests are correct rather than merely present. Loaded by the orchestrate skill; not usually invoked directly.
version: 1.0.0
user-invocable: false
metadata:
  origin: onestop
  phase: test
---

# Phase - Test

Implementation wrote tests slice by slice. This phase closes the gaps between slices,
verifies the coverage threshold, and audits that the tests actually test something.

**A test that passes without proving anything is worse than no test** - it reports
safety that does not exist. Auditing for that is the real work here.

## Scope

All **unit and integration** coverage for the change surface lives in this phase.
Nothing is deferred: end-to-end journeys belong to the automation phase, and a manual
test plan is a separate document - neither is a substitute for coverage here.

Cover, for everything the change touched:

- Every public function or method: happy path, boundaries, and error paths.
- Every route, handler, or module interaction the change introduced or altered.
- Every branch the plan acceptance criteria imply.
- The inferred states the request did not mention: empty, loading, failure, unauthorised.

## Correctness Checklist

Audit every test - the ones implementation wrote as well as the new ones. Any test
failing a line here is rewritten, not kept:

- **One behavior per test.** A test asserting five unrelated things tells you nothing
  useful when it fails.
- **Arrange, act, assert** - visibly separated.
- **Assertions on observable behavior**, never on internals the caller cannot see.
- **Never tautological.** `expect(x).toBe(x)`, asserting a mock was called when the
  mock is the whole test, or asserting on a value the test itself just set.
- **Never assertion-free.** A test that only checks nothing threw must say so
  explicitly, and only where that genuinely is the behavior.
- **Mocks at external boundaries only** - network, clock, filesystem, third-party
  service. Mocking the unit under test means testing the mock.
- **Deterministic and order-independent.** No shared mutable state, no reliance on
  execution order, no real clock, no real network, no random without a fixed seed.
- **Failure messages that locate the problem.** A bare `expected true, got false` in a
  CI log costs someone an hour.

## Coverage

Run the bound `coverage_cmd` for the detected stack. The threshold is the plugin
`coverage_threshold` setting, or the repo own configured threshold if it sets one -
the repo wins.

Report **line and branch** coverage for the change surface, not just the repo average.
A repo at 85 percent overall can have a new module at 20 percent; the average hides
exactly what matters.

Where coverage falls short, add tests for the uncovered behavior. **Never** lower the
threshold, exclude a file, or add an assertion-free test to move the number. If a
branch is genuinely unreachable, remove the dead code instead.

## Running

Run the full suite, not only the new tests. Report the real result.

If a test fails:

1. Determine whether the test or the code is wrong.
2. Wrong test - fix the test.
3. Wrong code - that is a defect. Fix it, and keep the test that caught it.
4. **Never** delete, skip, or weaken a failing test to get a green report.

If the suite cannot run here - missing runtime, missing service, missing credentials -
say so plainly and name what is missing. Never imply a suite passed that never ran.

## Traceability

If an RTM exists, fill `Test-Ref` for every requirement now covered by an automated test,
with the test `path:line`, and move `Status` to `verified`. Update the CSV to match.

Then report the honest coverage position: how many requirements have an automated test,
how many are waiting on the manual plan, and **how many have neither**. That last number
is the one that matters, and it is the one that quietly disappears from most projects.

## Output

```
TEST
  added:    <n> unit, <n> integration
  audited:  <n> existing tests reviewed, <n> rewritten, with the reason
  suite:    <pass / fail counts, and the exact command>
  coverage: <line and branch, for the change surface vs the threshold>
  gaps:     <anything intentionally untested, and why>
  defects:  <bugs the new tests exposed>
```

## Rules

1. **Never weaken a test to make it pass.**
2. **Never lower the coverage threshold or exclude a file to reach it.**
3. **Never write a stub.** Complete arrange-act-assert bodies only.
4. **Run the suite before handing off.** An unexecuted test is a guess.
5. **Report failures honestly, with output.** A green claim over a red suite destroys
   trust in every other phase.
6. **A test exposing a real bug is a success**, not an obstacle. Report it.
