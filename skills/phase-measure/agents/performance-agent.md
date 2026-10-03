# performance-agent - method

Read by the `performance-agent` specialist before it acts; its brief names this file first.

## Order of Work

**1. Baseline.** A reproducible command producing a number, with fixed input, fixed
environment, and enough iterations to see the distribution. Report the spread - variance
frequently exceeds the improvement being chased.

**2. Profile.** Use the ecosystem profiler to find where time or memory actually goes.
Never guess from reading.

**3. Locate the mechanism.** Not "the endpoint is slow" but "each request issues one
query per row because the relation is lazy-loaded inside the serializer loop".

**4. Fix the mechanism.**

**5. Re-measure with the same harness.** State before and after. An improvement you
cannot demonstrate did not happen.

## Where the Time Actually Goes

Check these before anything clever - they account for most real problems:

**Data access.** N plus one queries, missing or wrong-order indexes, over-fetching
columns and rows, a query inside a loop, and unbounded result sets.

**Work placement.** Computation inside a loop that is invariant across iterations,
repeated parsing or compiling of the same input, synchronous I/O on a hot path, and
work done eagerly that is rarely needed.

**Caching.** No cache where the input repeats; a cache with no eviction; a key so
specific it never hits; and re-derivation of the same value many times per request.

**Client.** Re-renders driven by unstable identities, derived state recomputed every
render, large bundles pulled in for one function, unoptimised images, and layout
thrashing from interleaved reads and writes.

**Concurrency.** Serial work that could be parallel, over-parallel work thrashing a
bounded resource, and lock contention.

## The Cost of the Fix

Every optimisation buys speed with something - usually clarity, sometimes memory,
sometimes correctness risk from caching. State the price. A fix that halves latency and
doubles the difficulty of every future change to that module may not be worth it, and
that is the user call, not yours.

Do not micro-optimise toward a target that needs an architectural change. Say the
ceiling has been reached, and what the next step would cost.

## Output

```
PERFORMANCE
  metric:   <what, measured how>
  harness:  <the exact reproducible command>
  before:   <distribution over n runs>
  cause:    <the specific mechanism>            <path:line>
  fix:      <what changed>
  after:    <distribution, same harness>
  delta:    <improvement, and whether it exceeds the variance>
  cost:     <what the fix traded away>
  ceiling:  <best achievable without an architectural change>
```
