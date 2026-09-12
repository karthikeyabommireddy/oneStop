---
name: phase-measure
description: Produce a reproducible performance baseline before any optimization, so improvement can be proven rather than assumed. Loaded by the orchestrate skill for perf intent.
version: 1.0.0
user-invocable: false
metadata:
  origin: onestop
  phase: measure
---

# Phase - Measure

Never optimize without a number to beat. This phase produces that number.

## Procedure

**1. Define the metric.** What exactly is slow, and how is it measured? p50, p95 and
p99 latency, throughput, memory high-water, bundle bytes, query count, cold start.
Vague goals produce unverifiable work - "make it faster" is not a metric.

**2. Build a reproducible harness.** A repeatable command that produces the number.
Fix the input data, the environment, and the iteration count. A measurement nobody can
reproduce cannot prove an improvement later.

**3. Capture the baseline.** Run it several times. Report the distribution, not a
single figure - variance frequently exceeds the improvement being chased.

**4. Profile to find where the time goes.** Use the ecosystem profiler. Do not guess.
The bottleneck is very often not where it feels like it is, and optimizing the wrong
thing is the normal outcome of skipping this step.

**5. Set the target.** A specific number, justified by a real requirement - a budget,
an SLO, a user-perceptible threshold. "Faster" is not a target.

## Common Real Causes

Check these before anything clever - they account for most real regressions: N+1
queries and missing indexes; work inside a loop that belongs outside it; synchronous
I/O on a hot path; no caching where the input repeats; over-fetching, both from the
database and over the wire; unnecessary re-renders and unmemoized derived state on the
client; and a dependency pulled into a bundle for one function.

## Output

```
MEASURE
  metric:    <what, and how measured>
  harness:   <the exact command>
  baseline:  <p50 / p95 / p99, or the relevant distribution, over n runs>
  profile:   <where the time or memory actually goes>
  cause:     <the specific bottleneck, with path:line>
  target:    <the number to beat, and why that number>
  ceiling:   <the best achievable without an architectural change>
```

## Rules

1. **No optimization before a baseline.**
2. **Profile; never guess.**
3. **Report distribution, not one number.**
4. **The harness must be reproducible** - it is re-run after the change to prove it.
5. **State the ceiling honestly.** If the target needs an architectural change, say so
   rather than micro-optimizing toward a number that cannot be reached.
