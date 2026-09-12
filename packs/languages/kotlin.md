# Pack: Kotlin

**Runner** JUnit 5 or Kotest, via `gradle test`.
**Coverage** Kover.
**Tests** `src/test/kotlin`; Android instrumentation in `androidTest`.

## Review focus

**Null safety.** The type system handles it - `!!` throws it away and is a defect
outside genuinely proven cases. Platform types from Java interop are unchecked; annotate
or validate at the boundary.

**Coroutines.** Every coroutine needs a scope with a defined lifetime -
`GlobalScope` leaks. Cancellation is cooperative: a tight CPU loop never cancels unless
it checks. A blocking call inside a coroutine must be wrapped in `withContext(IO)`.
Catching a generic exception swallows `CancellationException` and breaks cancellation -
rethrow it.

**Flow.** Cold by default; collection starts the work. `StateFlow` conflates and drops
intermediate values. Collect on a lifecycle-aware scope in UI code or it leaks.

**Scope functions.** `let`, `run`, `apply`, `also`, `with` - chained deeply they become
unreadable. One level is clarity; three is obfuscation.

**Data classes.** `copy` is shallow. `equals` covers constructor properties only - a
property declared in the body is excluded, which surprises people.

**Compose.** A composable must be side-effect free during composition - use
`LaunchedEffect` or `SideEffect`. Unstable parameters defeat recomposition skipping.
State must be remembered or it resets on every recomposition.

**Android.** Never hold a `Context` in a long-lived object. Respect lifecycle for
observers and listeners; an unregistered listener leaks the whole activity.
