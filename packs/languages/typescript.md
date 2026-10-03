# Pack: TypeScript / JavaScript

**Runner** vitest (default), jest, node:test, bun test - detect from the manifest.
**Coverage** `npx vitest run --coverage`
**Tests** beside source as `*.test.ts`, or in `tests/` - follow the repo.

## Review focus

**Type honesty.** `any` erases checking and spreads through everything it touches -
prefer `unknown` plus narrowing. A type assertion (`as`) is an unchecked claim; each one
needs a reason. `as any` to silence an error is a defect. Non-null assertion (`!`) on a
value that can be null is a crash waiting for a bad input.

**Async correctness.** A floating promise swallows its rejection - every promise is
awaited, returned, or explicitly handled. `forEach` does not await; use `for...of` or
`Promise.all`. Sequential awaits in a loop over independent work should be `Promise.all`.
An unhandled rejection in Node terminates the process by default.

**Equality and coercion.** `==` outside `== null` is a defect. Falsy checks on numbers
and strings mishandle `0` and `""` - use `?? ` and explicit comparisons. `??` and `||`
are not interchangeable.

**Mutation.** Array methods that mutate in place (`sort`, `reverse`, `splice`) surprise
callers holding the same reference. Object spread is shallow - a nested object is still
shared.

**Module and boundary.** Validate external input at the boundary with a schema
validator; a TypeScript interface proves nothing at runtime about JSON from the network.

**Error handling.** A caught value is `unknown`, not `Error` - narrow before reading
`.message`. Never an empty catch.

## Standards idioms

The shared standards, as TypeScript.

```ts
// Immutability: new values, not edits. Copy before an in-place sort.
const updatedUser  = { ...user, name: nextName };
const updatedItems = [...items, newItem];
const ranked       = [...items].sort(byScore);

// A deliberate mutation says why.
// Deliberate mutation: this array is local, and the copy showed up in the profile.
buffer.push(chunk);
```

In React a mutated object keeps its identity, so nothing re-renders and the bug presents
as a stale UI far from its cause.

```ts
// Errors: fetch does not throw on a 404 - check the status.
const response = await fetch(url);
if (!response.ok) {
  throw new HttpError(`${response.status} ${response.statusText}`, { url });
}

// Async: independent work runs together; allSettled when one failure must not lose the rest.
const [users, markets, stats] = await Promise.all([fetchUsers(), fetchMarkets(), fetchStats()]);

// Types: a closed set, not a free string; validate unknown input with a schema at the boundary.
interface Market {
  id: string;
  status: 'active' | 'resolved' | 'closed';
  createdAt: Date;
}

// Constants: named, in the component's one constants home.
const MAX_RETRIES = 3;
const DEBOUNCE_DELAY_MS = 500;

// Comments: the why.
// Exponential backoff: the upstream rate-limits aggressively during incidents, and a
// fixed retry interval turned a partial outage into a full one.
const delayMs = Math.min(BASE_DELAY_MS * 2 ** retryCount, MAX_DELAY_MS);
```
