---
name: phase-discovery
description: Search the repository to establish what already exists before any planning or questioning happens. Runs one scout pass per unit of work, aggregates the findings, and hands the orchestrator a resolved decision set plus the short list of choices that genuinely need the user. Loaded by the orchestrate skill; not usually invoked directly.
version: 1.0.0
user-invocable: false
metadata:
  origin: onestop
  phase: discovery
---

# Phase - Discovery

This phase exists to make questions unnecessary. Every question the orchestrator asks
the user is a question this phase failed to answer.

## Inputs

- The units of work: one per flow step for `flow` intent, otherwise one for the whole
  request.
- Context from orchestrate Step 0 - stack, components, conventions, change surface.

## Execution

**Fan out, one scout per unit, in parallel.** Delegate each unit to the
`discovery-scout` agent. Units are independent and read-only, so they can never
collide - this is the safest parallelism in the whole pipeline and there is no reason
to give it up.

**Dispatch every scout in ONE message.** Agent calls issued in separate turns run
sequentially no matter how the transcript reads. Pass each scout only its own unit plus
the Context extract - never the whole conversation.

For a `trivial` or `small` tier, skip the fan-out and run one inline pass. The
ceremony must stay proportional to the work.

## Aggregation

Collect the scout records and merge them into one picture:

1. **Deduplicate findings.** Several steps of a flow usually touch the same module.
   Report it once, and note which steps depend on it - shared modules are where the
   flow steps couple, and that ordering matters to the planner.
2. **Reconcile conflicts.** If two scouts report different conventions for the same
   concern, the one closest to the change surface wins. Note the inconsistency; it is
   often a finding in its own right.
3. **Collapse cross-unit options.** The same choice surfacing in three steps is ONE
   decision, asked once, applied everywhere.
4. **Build the dependency order.** Producers before consumers. This becomes the
   planner build order, so get it right here.

## Handing Off Choices

Run the aggregated `OPTIONS` blocks through the `option-broker` agent. It applies the
resolution cascade and returns three lists: resolved silently, must ask, and blocked
on missing information.

- **Resolved** - record each with its rule and evidence in the run ledger. State them
  compactly; do not ask the user to confirm them.
- **Must ask** - hand the formatted batch to the orchestrator for a SINGLE
  interruption covering the whole phase.
- **Blocked** - these go into the same interruption, framed as missing information
  rather than as a choice.

## Output

```
DISCOVERY
  units:       <n> searched
  exists:      <what is already built, grouped, with paths>
  gaps:        <what must be built, per unit>
  conventions: <the patterns implementation must follow>
  order:       <dependency-ordered unit list for the planner>
  resolved:    <n> choices settled without asking, each with its rule
  asking:      <n> choices going to the user
  confidence:  high | medium | low, with what is still unknown
```

## Rules

1. **Never skip discovery to save time on anything above `small` tier.** Building a
   second implementation of something that already exists is the most expensive
   mistake this pipeline can make.
2. **Never let a scout write anything.** This phase is strictly read-only.
3. **Never pass a raw scout record forward.** Aggregate first; the planner gets the
   merged picture, not four overlapping reports.
4. **A confident negative is a result.** "Searched these six terms across the repo,
   nothing exists" is exactly what lets planning proceed without a question.
5. **Report low confidence honestly.** A guess presented as a finding poisons every
   later phase.
