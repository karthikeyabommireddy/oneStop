---
name: phase-plan
description: Turn the discovery picture into an ordered task list of thin vertical slices, each with its own acceptance criteria and test strategy. Produces the artifact presented at the plan gate. Loaded by the orchestrate skill; not usually invoked directly.
version: 1.0.0
user-invocable: false
metadata:
  origin: onestop
  phase: plan
---

# Phase - Plan

Produce the task list the implementation phase will execute, and the artifact the user
approves at **the plan gate**. This is the cheapest point in the pipeline to be wrong, so it
is the point where being precise pays most.

## Inputs

Discovery output (exists, gaps, conventions, dependency order), the resolved decision
set, the intent, and the tier.

## Delegation

Route by what the work actually needs:

| Work shape | Agent |
|---|---|
| Feature or flow with a known structure | `planner` |
| Structural decisions, new modules, layering | `architect` |
| System-level, cross-service, new external dependency | `architect` |

For `standard` tier and below, one agent is enough. For `large`, run `architect` for
the shape and `planner` for the slicing, in that order.

## Slicing Rule

**Every task is a thin vertical slice that leaves the system working.**

A slice cuts through every layer it needs - route, handler, data access, UI, test -
and ends with something demonstrable. It is never "add the database table" followed
three tasks later by "add the endpoint". Horizontal layering produces long stretches
where nothing is verifiable, and it hides integration problems until the end, which
is the worst time to find them.

Each task carries:

- **Title** - the observable outcome, in the user language of the request.
- **Acceptance criteria** - observable, testable, and specific. These become the test
  assertions verbatim, so vague criteria here produce vague tests later.
- **Touches** - the files and modules, from discovery. If a task touches files no
  scout saw, discovery was incomplete - go back rather than guessing.
- **Test strategy** - which level proves this slice: unit, integration, or end to end.
  Not everything needs an E2E; not everything is provable by a unit test.
- **Depends on** - the task ids that must land first, from the discovery order.

## Sizing

A task should be completable and verifiable in one focused pass. If a task needs more
than about five files or contains the word "and" in its title, split it. If two tasks
always have to ship together to leave the system working, merge them.

## Risk Register

List, briefly, only the risks that would actually change the plan:

- Anything touching a `security_trigger` - name the surface, so review binds the
  security reviewer.
- Anything that could break an existing consumer - a public API, a wire contract, a
  database migration.
- Anything with an unproven assumption that a spike would settle faster than a debate.

Skip generic risk boilerplate. A register nobody acts on is noise.

## Plan Gate Artifact

Present exactly this, then stop and wait:

```
PLAN - <one-line restatement of what will be built>
  intent: <intent>   tier: <tier>

TASKS
  1. <title>                                        [test: unit + e2e]
     criteria: <observable outcome>
     touches:  <paths>
  2. ...

DECIDED WITHOUT ASKING
  <choice> - <rule that settled it> - <evidence>

BOUND SPECIALISTS
  <reviewers, build resolver, test runner, automation frameworks>

RISKS
  <only the plan-changing ones>

Approve to begin implementation, or tell me what to change.
```

`trivial` and `small` tiers state the plan in a few lines and continue without
stopping - there is nothing meaningful to approve.

## Rules

1. **No implementation code before the plan gate approval.** Not a scaffold, not a stub.
2. **Never plan around a gap discovery did not confirm.** Verify, do not assume.
3. **Every task is independently verifiable.** If you cannot say how a task is proven
   done, it is not a task yet.
4. **Reuse beats writing.** If discovery found something that does the job, the task
   is to extend it, and the plan says so explicitly.
5. **Keep the plan honest about scope.** Inferred steps - error, empty, loading, auth
   failure - appear as real tasks, marked inferred, not as afterthoughts.
