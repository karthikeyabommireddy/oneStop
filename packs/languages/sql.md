# Pack: SQL / Relational data

Loaded alongside an application pack whenever the change touches migrations, schema or
query files. Never the sole pack for a change.

## Review focus

**Indexes.** A predicate with no usable index is a sequential scan that works in
development and fails in production. A composite index serves a prefix of its columns
in order - `(a, b)` helps a query filtering on `a`, or on `a` and `b`, but not on `b`
alone. An index on a low-cardinality column rarely earns its write cost. Read the query
plan rather than guessing.

**Migrations under rolling deploy.** Old code runs against the new schema during the
window. Dropping or renaming a column breaks it immediately. Adding a non-null column
without a default breaks old inserts. The safe shape is expand, migrate, contract,
across separate deploys.

**Locking.** Adding an index, rewriting a table, or validating a constraint against
existing rows can lock a large table long enough to be an outage. Use the concurrent
variant where the engine offers one.

**Constraints.** An invariant that must always hold belongs in the database - not null,
unique, foreign key, check. Application-only enforcement fails the moment a second
writer exists, and there is always eventually a second writer.

**Correctness.** A join that multiplies rows silently inflates aggregates. `NOT IN` with
a NULL in the subquery returns nothing - a genuinely surprising and common bug. `NULL`
is never equal to anything, including `NULL`.

**Transactions.** Know the isolation level. Read-modify-write without locking or a
retry is a lost update. Long transactions hold locks and bloat.

**Unbounded queries.** A query with no limit against a growing table works until it does
not. Pagination needs a deterministic ordering, or rows repeat and vanish between pages.
