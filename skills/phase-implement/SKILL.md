---
name: phase-implement
description: Execute the approved task list test-first, one vertical slice at a time, following the conventions discovery recorded. Drives the red-green-refactor loop, repairs build breaks in place, and keeps the suite green between slices. Loaded by the orchestrate skill; not usually invoked directly.
version: 1.0.0
user-invocable: false
metadata:
  origin: onestop
  phase: implement
---

# Phase - Implement

Execute the approved plan. One slice at a time, test-first, suite green at every
boundary.

## Preconditions

Gate 1 is approved. The contract exists if the design phase produced one. If either
is missing, stop - implementing against an unapproved plan is how scope escapes.

## Partition First

Before any code is written, delegate to `work-partitioner`. It resolves the true write
surface of every task - including the registration files the plan never mentions - and
groups the tasks into waves that can safely run at the same time.

The partition decides how this phase executes:

| Partition result | Execution |
|---|---|
| Two or more lanes in at least one wave | **parallel** - drive via the `parallel-execution` skill |
| Every wave is a single lane | **serial** - the slice loop below |
| Tier `trivial` or `small` | **serial** - the change is smaller than a lane brief |

Say which mode you are in and why, in one line. If the partition found no parallelism,
say that plainly rather than pretending the DAG was a chain by choice.

## Parallel Mode

Follow `${CLAUDE_PLUGIN_ROOT}/skills/parallel-execution/SKILL.md`. In short: dispatch every lane of a wave in
**one message**, brief each lane with only its own task, its write surface, the contract
and the standards, then join through `merge-coordinator` before the next wave.

Each lane still runs the slice loop below inside its own task. Parallelism changes who
runs the loop and when - it never relaxes test-first, and it never relaxes the standards.

The contract is what unlocks most of this: once the interface is agreed, both sides are
built at the same time instead of one waiting for the other.

## The Slice Loop

For each task in dependency order - inside a lane, or serially:

**1. Red.** Write the failing test first, from the task acceptance criteria. Run it.
Confirm it fails, and that it fails *for the reason you expect* - a test that passes
before the code exists, or fails on a typo, proves nothing. Delegate to `test-author`.

**2. Green.** Write the simplest code that passes. Not the most general, not the most
clever - the simplest. Generality that no current caller needs is speculative work.

**3. Refactor.** With the test green, improve the structure. Extract, rename, remove
duplication. The tests must stay green throughout; if they go red, the refactor changed
behavior and must be reverted.

**4. Verify the boundary.** Run the full suite, not just the new test. A slice that
breaks an existing test is not done. Delegate a build break to the bound
`build-resolver` for a minimal fix - never an architectural change to clear a build.

In parallel mode step 4 belongs to the **join**, not the lane: a lane verifies its own
task, and `merge-coordinator` verifies the combination once for the whole wave.

Announce each slice in one line. Do not ask permission between slices.

## Intent-Specific First Moves

The intent decides how the loop starts. This is not optional:

- **defect** - reproduce as a failing regression test BEFORE reading the fix. The test
  must fail against current code for the reported reason. That test is the proof the
  bug was real and stays fixed.
- **change** - update the existing tests to the NEW specification first, watch them
  fail, then change the implementation. Never change code and tests together in one
  motion; you lose the signal.
- **refactor** - the suite must be green and must actually cover the code being moved
  before anything is touched. Untested code gets characterization tests first. No
  behavior change is permitted, and no test assertion may be weakened.
- **feature, flow, mvp** - straight red-green-refactor per slice.

## Code Standards

Enforced on every file written, and checked in review:

- **File size.** Target 300 lines, hard fail at 400. One responsibility per file.
  Decompose in the planned structure, before writing - never emit a monolith intending
  to split it later. A file already near the cap gets an extraction, not more lines.
- **Constants.** One constants home per component, following the ecosystem idiom.
  Every magic number, status string, limit, and shared literal lives there. Never
  inline a value used more than once; never duplicate a literal across files.
- **Follow the discovered conventions.** Directory layout, naming, error handling,
  validation placement, test location - match the siblings discovery found. Consistency
  with the codebase beats personal preference every time.
- **Errors.** Never swallow one. Every catch either handles meaningfully, enriches and
  rethrows, or is a documented deliberate no-op. No silent fallback that hides failure.
- **Secrets.** Never hardcoded. Environment variables, with a `.env.example` entry for
  every new key.

## Edit in Place

When a target exists, modify it. Never create `*_new`, `*-v2`, `*.updated`, or a
parallel component with a suffix. Never append a duplicate of an existing function
beside the original. Never scaffold a fresh tree when the project has one. New files
are for genuinely new modules only. **This rule travels with every subagent
delegation** - state it verbatim when delegating.

## Delegation and Token Discipline

Bulk mechanical file writing may go to a subagent, carrying only: the task and its
criteria, the contract, the relevant discovery extract, the stack reference, and the
Code Standards block verbatim. Only the summary returns - files written, decisions,
open issues. Never let generation churn into the main context. Run inline instead when
the slice needs mid-flight judgement.

## Traceability

If an RTM exists at `docs/ba/<feature>/RTM.md`, fill `Impl-Ref` for every requirement a
completed slice satisfies, with the `path:line` of the implementation, and move its
`Status` to `implemented`. Update the CSV to match.

A requirement whose slice landed but whose row still reads `specified` makes the matrix
lie, and a matrix nobody trusts stops being maintained within a sprint.

## Output

```
IMPLEMENT
  slices:   <n> of <n> complete
  files:    <written / modified counts, and the tree - never the bodies>
  tests:    <added, and the suite result at the last boundary>
  decisions:<anything decided during implementation that the plan did not cover>
  blocked:  <any slice not completed, and exactly why>
```

## Rules

1. **Test first, always.** No production code before a failing test that justifies it.
2. **Suite green at every slice boundary.** Not at the end - at every boundary.
3. **Never weaken or delete a test to make the suite pass.** Fix the cause.
4. **Never exceed the plan.** Unplanned work found mid-slice is reported, not absorbed.
5. **Edit in place.** No parallel copies, ever.
6. **Never echo file bodies into chat.**
