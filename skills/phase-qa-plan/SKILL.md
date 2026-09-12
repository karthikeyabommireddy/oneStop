---
name: phase-qa-plan
description: Draft the manual testing plan for the change as a document plus an importable CSV, covering what a human tester does on top of the automated suites. Runs after automation, before review. Loaded by the orchestrate skill; not usually invoked directly.
version: 1.0.0
user-invocable: false
metadata:
  origin: onestop
  phase: qa-plan
---

# Phase - QA Plan

Produce the manual testing plan for the change. Delegate to `qa-planner`.

## Boundary

This phase writes **documents only**. Every automated test - unit, integration,
end-to-end, web and app - was produced by the test and automation phases. Nothing is
deferred here, and a manual case is never a substitute for a missing automated test.

If `qa-planner` finds an automated coverage gap, it reports it. The gap goes back to the
test phase; it does not get papered over with a manual step.

## When It Runs

- `standard` tier and above, for user-facing change.
- Whenever the repo already keeps plans in `docs/test/` - follow the team practice.
- Skipped for `trivial` and `small`, for internal refactors, and for changes with no
  human-observable surface. Say so in one line.

## Traceability

Every case carries the `Req-ID` it verifies. After the plan is written, update the RTM:
manual cases fill `Test-Ref` for requirements that automation could not reach.

A requirement with neither an automated nor a manual test is a coverage hole, and it must
appear as one in the RTM rather than being quietly absent.

## Output

```
QA PLAN
  cases:      <n> by priority
  files:      <md, csv>
  traced:     <requirements covered> / <total in scope>
  uncovered:  <requirements with no test of any kind>
  gaps:       <automated coverage missing, returned to the test phase>
```

## Rules

1. **Documents only.** No test code.
2. **Plan the change, not the product.**
3. **Every case links to a requirement.**
4. **Report uncovered requirements** rather than omitting them.
5. **Skip cleanly** when there is no human-observable change.
