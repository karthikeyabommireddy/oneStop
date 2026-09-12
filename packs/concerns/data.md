# Concern: Data

Loaded when a stack routinely touches persistent state. The `data-reviewer` owns the
full review; this pack is what every agent applies while writing data code.

- Invariants that must always hold belong in the database as constraints, not only in
  application code.
- Every migration states whether it is reversible, and what is lost if it is not.
- Assume a rolling deploy: old code runs against the new schema. Expand, migrate,
  contract - across separate deploys.
- Backfills are batched and resumable.
- No query inside a loop. Eager-load the relations you will use.
- Every predicate on a growing table needs a usable index, in the right column order.
- Every collection query has a limit and a deterministic ordering, or pagination repeats
  and drops rows.
- Read-modify-write needs a lock, a version check, or a retry.
- Know the isolation level before relying on a transaction to protect an invariant.
