# Pack: Rust

**Runner** `cargo test`
**Coverage** `cargo llvm-cov --summary-only`
**Tests** unit tests in-module under `#[cfg(test)]`, integration tests in `tests/`.

## Review focus

**Unwrap and panic.** `unwrap()` and `expect()` in library or request-handling code turn
a recoverable condition into a crash. Acceptable in tests, in `main`, and where an
invariant is genuinely proven - and then `expect` with a message stating the invariant.
Indexing a slice panics; `get()` returns an `Option`.

**Error handling.** A concrete error type with `thiserror` for libraries, `anyhow` for
applications. `?` propagates - check that the conversion chain is meaningful and that
context is added rather than lost.

**Ownership.** Excessive `.clone()` usually signals a borrow that should have been
restructured. Fighting the borrow checker with `Rc<RefCell<T>>` everywhere trades a
compile error for a runtime panic on double borrow.

**Lifetimes.** Elision covers most cases; an explicit lifetime that is hard to read is
often a sign the data should be owned instead.

**Unsafe.** Every `unsafe` block needs a comment stating the invariant that makes it
sound, and that invariant must actually hold. Review these with real care.

**Concurrency.** `Send` and `Sync` are enforced, which removes most data races - but
deadlock is still possible. A `MutexGuard` held across an `await` blocks the executor
and can deadlock. Prefer message passing.

**Traits and generics.** Prefer generics over `dyn` where monomorphisation is affordable.
A blanket impl can conflict surprisingly.
