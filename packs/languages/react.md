# Pack: React / Next.js

**Runner** vitest or jest with React Testing Library.
**Tests** behavior and accessibility first - query by role and label, never by class or
test id unless nothing else identifies the element.

## Review focus

**Hook rules.** Never conditional, never in a loop, never after an early return. A
missing dependency in `useEffect`, `useMemo` or `useCallback` captures a stale value -
the lint rule is right far more often than the developer overriding it.

**Effects.** Most effects are unnecessary. Derived state belongs in render, not in an
effect that sets state. An effect that synchronises with an external system needs a
cleanup function, and one that fetches needs cancellation on unmount or on a changed
key - otherwise a slow response overwrites a newer one.

**Keys.** An array index as a key corrupts state when the list reorders or filters. Use
a stable identity from the data.

**Render cost.** An object, array or function literal in props changes identity every
render and defeats memoisation. Context value objects must be memoised or every consumer
re-renders. Do not reach for `memo` before establishing there is a real cost.

**Server and client boundary (Next.js App Router).** A `"use client"` component cannot
receive a function or a class instance as a prop. Secrets and server-only modules must
never be imported into a client component - check the import graph, not just the file.
`async` components are server-only.

**State.** Never mutate state directly. Derived values are computed, not stored - two
sources of truth drift.

**Accessibility.** A click handler on a non-interactive element is a keyboard failure.
Every interactive element needs an accessible name.
