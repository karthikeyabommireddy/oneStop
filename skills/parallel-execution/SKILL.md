---
name: parallel-execution
description: The wave scheduler. Turns a task DAG into waves of independent agents that run at the same time, joins each wave, and continues around failures. Shared engine used by the discovery, implement, test, automation and review phases. Loaded by the orchestrate skill; not usually invoked directly.
version: 1.0.0
user-invocable: false
metadata:
  origin: onestop
  role: execution-engine
---

# Parallel Execution Engine

Independent work runs at the same time. Dependent work waits. The write surface, not the
dependency graph, is what decides which is which.

Rules live in `${CLAUDE_PLUGIN_ROOT}/registry/parallel.json`; this skill is how they are executed.

## The One Mechanical Rule

**A wave is dispatched as several Agent calls in a SINGLE message.**

Agent calls issued in separate assistant turns run one after another. They will look
parallel in the transcript and be entirely sequential in reality. If you take one thing
from this skill: the lanes of a wave go out together, in one turn, or there is no
parallelism at all.

## The Loop

```
partition  ->  wave 1 (n lanes, one message)  ->  join  ->  verify
           ->  wave 2 (m lanes, one message)  ->  join  ->  verify  ->  ...
```

1. **Partition.** `work-partitioner` builds the DAG, resolves true write surfaces, and
   forms the waves. Done once, after Gate 1.
2. **Dispatch.** All lanes of the wave in one message. Each agent receives only what it
   needs - its task, its acceptance criteria, its write surface, the contract, the
   relevant knowledge-graph extract, and the coding standards verbatim. Never the
   conversation.
3. **Join.** `merge-coordinator` collects results, verifies the combination, hunts
   semantic conflicts, and decides what is unblocked.
4. **Repeat** until the DAG is drained.

## What Each Lane Gets

A lane agent is isolated - it cannot see the conversation, the other lanes, or what they
decided. Everything it needs must be in its brief:

- The task, and its acceptance criteria in observable terms.
- **Its write surface**, stated explicitly, with the instruction to write nothing outside
  it. This is the lane contract and it is what keeps the wave safe.
- The interface contract, if one exists.
- The knowledge-graph extract for its area - not the whole report.
- The repository conventions that apply, and the coding standards **verbatim**.
- The edit-in-place rule, verbatim.

Keep briefs tight. Five lanes each carrying the full context is five times the cost for
no benefit.

## Where Parallelism Comes From

**Discovery.** One scout per flow step. Always parallel, always safe - read-only.

**Contract-enabled implementation.** The largest win in a normal feature. Once the
interface is agreed, both sides of it are built at the same time instead of one waiting
for the other. Look for this deliberately; it is why the design phase writes the contract
before implementation starts.

**Independent slices.** Vertical slices touching different modules.

**Review.** Every reviewer reads the same diff and writes nothing. Running them
sequentially is pure waste.

**Automation.** Web and app targets are different files and different runners.

**Speculative review.** Review a finished slice while later slices are still running.
Re-validate at the real join - a review of code that later changed is stale, so re-review
only the delta.

## Isolation

Default is no isolation: the partition already guarantees disjoint writes.

Use `isolation: "worktree"` on the Agent call when two substantial lanes genuinely need
the same files, or when a lane is experimental and might be thrown away. Each lane gets
its own git worktree, so overlapping writes cannot collide. The cost is a checkout per
lane and a real merge afterwards - worth it for large independent lanes, overkill for a
two-file change.

## Failure

Lanes are independent, so a failure in one does not stop the others - they are already
paid for. Let the wave finish, report exactly which lane failed with its real output,
block only the tasks that depended on it, and schedule the next wave from whatever is
still unblocked. Progress continues around the failure.

Retry only a transient cause, at most once. Never retry a logic failure.

**Never report a wave as successful when a lane failed.**

## When Not To

Parallelism has a cost - briefing, joining, conflict hunting. Skip it when:

- The DAG is a chain. Nothing is independent; wave scheduling adds overhead and saves
  nothing.
- Fewer than two lanes would run concurrently.
- Tier is `trivial` or `small`. The whole change is smaller than one brief.
- The longest path dominates the total. Say so - the honest report is that parallelism
  buys little here.

## Output

```
WAVE <n>  (<k> lanes)
  lane | task | agent | write surface | result | files
  join: build <result> | suite <result>
  conflicts: <found and resolved, or none>
  next: unblocked <ids> | blocked <ids, and why>
```

## Rules

1. **One message per wave.** Separate turns are sequential.
2. **Disjoint write surfaces, always.** No exception for a small change.
3. **Verify the combination at every join**, with the full suite.
4. **Never report a lane result you did not receive.**
5. **Continue around failures**; never stall independent work.
6. **Brief tightly.** Extracts, never the conversation.
7. **Say honestly when parallelism did not help.**
