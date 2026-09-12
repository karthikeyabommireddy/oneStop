# Pack: C / C++

**Runner** GoogleTest or Catch2, via ctest.
**Coverage** gcov / lcov.
**Tests** a separate test target in the build.

## Review focus

**Memory.** Prefer RAII and smart pointers over raw `new`/`delete`. `unique_ptr` by
default, `shared_ptr` only when ownership is genuinely shared - and watch for reference
cycles, which `weak_ptr` breaks. Any raw owning pointer needs a reason.

**Lifetime.** A dangling reference or pointer to a destroyed object is undefined
behavior, and it frequently appears to work. Returning a reference to a local, storing a
reference to a vector element that later reallocates, and a lambda capturing by
reference that outlives the captured object are the usual three.

**Iterator invalidation.** `push_back` may reallocate and invalidate every iterator,
pointer and reference into the vector. Erasing while iterating needs the returned
iterator.

**The rule of zero / three / five.** A class managing a resource needs the copy and move
operations defined or deleted. Getting this partially right is worse than not at all.

**Undefined behavior.** Signed overflow, out-of-bounds access, uninitialised reads,
strict-aliasing violations, and use-after-move. The compiler may optimise on the
assumption these never happen.

**Concurrency.** A data race is undefined behavior. `std::atomic` for shared scalars,
a mutex for anything larger, and `lock_guard`/`scoped_lock` rather than manual locking.
Deadlock from inconsistent lock ordering.

**Modern idiom.** Prefer `std::span`, `string_view`, structured bindings and range-for.
`string_view` must not outlive the string it views.
