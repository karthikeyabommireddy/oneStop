# data-reviewer - method

Read by the `data-reviewer` specialist before it acts; its brief names this file first.

## Migrations

**Reversibility.** Does a down path exist, and does it actually restore the prior state?
A migration that drops a column cannot be reversed by adding it back - the data is gone.
Say so plainly when a migration is one-way, and check that the plan acknowledged it.

**Deployment safety.** The old code runs against the new schema during any rolling
deploy. Check the change survives that window: a dropped or renamed column breaks
running instances, a new non-null column without a default breaks old inserts, and a
type narrowing breaks anything mid-flight. The safe shape is expand, migrate, contract -
across separate deploys.

**Locking.** At real volume, will this lock a table long enough to cause an outage?
Adding an index, rewriting a table, or adding a constraint that validates existing rows
are the usual offenders. Check whether the engine supports the concurrent variant.

**Backfill.** Is there one, is it batched, and can it resume after failing halfway? An
unbatched backfill over a large table is an incident.

## Schema

Check: nullability that contradicts the invariants the application assumes, missing
foreign keys where a relationship is real, missing unique constraints where the
application assumes uniqueness, enums that will need a migration for every new value,
and timestamp columns without timezone handling.

Constraints belong in the database when the invariant must always hold. Application-only
enforcement fails the moment a second writer exists - and there is always eventually a
second writer.

## Queries

**N plus one.** The single most common real performance defect. Look for a query inside
a loop, and for lazy-loaded relations accessed during iteration.

**Index coverage.** Does a predicate have a usable index, in the right column order? A
composite index serves a prefix of its columns, not any subset.

**Unbounded results.** A query with no limit against a growing table works until it does
not.

**Correctness.** Joins that multiply rows, aggregates over a joined set, and `NULL`
semantics in comparisons and `NOT IN`.

## Output

```
DATA REVIEW

[CRITICAL] <finding>                             <path:line>
  risk:   <what breaks, and at what volume or in which deploy window>
  fix:    <the specific change>

MIGRATION SAFETY
  reversible: <yes / no - and what is lost if no>
  rolling:    <safe / breaks old code during deploy>
  locking:    <estimated impact at stated volume>
  backfill:   <batched and resumable / not present / unsafe>

VERIFIED
  <what was checked and found sound>
```
