# Pack: F#

**Runner** Expecto or xUnit, via `dotnet test`.
**Tests** a separate test project.

## Review focus

**Totality.** A pattern match must handle every case - an incomplete match is a runtime
exception waiting for the case nobody thought of. Treat the incomplete-match warning as
an error. Avoid a catch-all `_` on a discriminated union: when a new case is added, the
compiler should tell you every place that needs updating, and `_` silences exactly that.

**Make illegal states unrepresentable.** This is the language main advantage - model
with discriminated unions so invalid combinations cannot be constructed, rather than
validating a record with optional fields at every use site.

**Option over null.** `Option` for absence. `.Value` on a `None` throws - use pattern
matching or `Option.defaultValue`. Null arrives from .NET interop; handle it at that
boundary and never let it further in.

**Result for expected failure.** Exceptions for the exceptional, `Result` for failure
that is part of the domain. Keep the error type meaningful rather than a string.

**Immutability.** `mutable` and mutable collections need a reason. A closure capturing
a mutable local is a common source of confusion.

**Computation expressions.** Powerful, and easy to make unreadable. A custom builder
needs a clear reason and documentation of what it does with each keyword.

**Async.** F# `Async` is cold and needs `Async.RunSynchronously` or `Async.Start`; `Task`
is hot and starts immediately. Mixing the two without understanding this is a frequent
bug. `Async.AwaitTask` at the boundary.

**Type inference.** Inference is strong but order-dependent - a file appearing later in
compile order cannot be referenced. Annotate public API signatures for clarity.
