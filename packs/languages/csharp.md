# Pack: C# / .NET

**Runner** xUnit, NUnit or MSTest, via `dotnet test`.
**Coverage** `dotnet test --collect:"XPlat Code Coverage"`
**Tests** a separate test project per assembly.

## Review focus

**Nullable reference types.** Enable them. A `!` null-forgiving operator is an unchecked
claim. A nullable warning suppressed project-wide removes the whole benefit.

**Async.** `async void` is only ever valid for event handlers - anywhere else its
exceptions are unobservable and crash the process. Never `.Result` or `.Wait()` on a
task; it deadlocks in a synchronisation context. `ConfigureAwait(false)` in library code.
An `async` method with no `await` should not be `async`.

**Disposal.** `using` for anything `IDisposable`. A type holding a disposable field must
itself be disposable. `HttpClient` is the classic inversion - it should be long-lived
and shared (via `IHttpClientFactory`), not created per request.

**LINQ.** Deferred execution means the query runs when enumerated - enumerating twice
runs it twice, and against a database that is two round trips. Watch for a query
materialised inside a loop. `IEnumerable` returned from a data layer can leak an open
connection.

**Entity Framework.** Lazy loading in a loop is the N plus one defect. `AsNoTracking`
for read-only queries. A `DbContext` is not thread-safe and must be short-lived.

**Exceptions.** `throw;` preserves the stack trace, `throw ex;` destroys it. Never catch
and continue silently.

**Records and structs.** Records give value equality; a mutable struct behaves
surprisingly when copied.
