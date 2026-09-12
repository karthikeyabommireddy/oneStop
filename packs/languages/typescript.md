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
