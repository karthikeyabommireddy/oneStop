# Shared - Coding standards

The line-level floor, applied to every file onestop writes and checked in every review.

Three layers, and they do not overlap:

| Layer | Answers | Lives in |
|---|---|---|
| **Architecture** | how the system is shaped | `${CLAUDE_PLUGIN_ROOT}/skills/shared/architecture.md` |
| **Standards** (this file) | how a line of code is written | here |
| **Language packs** | what is idiomatic in this language | `${CLAUDE_PLUGIN_ROOT}/packs/languages/` |

When a language pack disagrees with this file, **the pack wins** - it knows the idiom.
When the repository disagrees with the pack, **the repository wins**. Consistency with
the surrounding code beats theoretical superiority every time, and a change that is
correct but foreign is still a change the team has to live with.

---

## 1. The four principles, and where each one fails

**Readability first.** Code is read far more often than it is written, and it is read
under pressure - at 2am, by someone who did not write it, trying to find one thing. A
clear name is worth more than a clever construction. Self-documenting code beats a
comment explaining code that is not.

**KISS.** The simplest thing that works. Not the most general, not the most extensible -
the simplest. Generality no current caller needs is speculative work with a maintenance
bill attached.

**DRY, with the caveat that matters.** Extract shared logic, share utilities, do not
copy-paste. But **the wrong abstraction costs more than duplication**: two functions that
look alike today and diverge tomorrow become one function with a boolean parameter, then
two, then a flag argument nobody can read. The working rule is three strikes - duplicate
once without ceremony, and extract on the third occurrence, when the shape of the
abstraction is actually visible. Deduplicating on the second occurrence is a coin flip.

**YAGNI.** Do not build for a requirement nobody has stated. The interface with one
implementation and no second in prospect, the config option nothing sets, the plugin
system for a single plugin - each is a defect that looks like foresight.

---

## 2. Naming

Names are the highest-leverage decision at this level, because every reader pays for a
bad one and nobody is ever scheduled to fix it.

- **Variables describe the value**, not its type or its position. `marketSearchQuery`,
  not `q`, `str` or `data2`.
- **Functions are verb-first.** `fetchMarketData`, `calculateSimilarity`,
  `isValidEmail`. A function named for a noun (`market(id)`) reads as a value at every
  call site and hides that work is happening.
- **Booleans ask a question** - `is`, `has`, `should`, `can`. `isAuthenticated`, not
  `flag` or `auth`.
- **Say what the units are** when a number has any: `delayMs`, `timeoutSeconds`,
  `priceCents`. A bare `delay` has caused an outage in every codebase that has one.
- **No category names.** `utils`, `helpers`, `manager`, `common`, `misc` - a file with
  one of these names has no single responsibility, and it will accumulate until nobody
  can describe it. Name for what it does.
- **Match the surrounding convention** for casing and file naming. If the repo uses
  `market.types.ts`, the next one is not `MarketTypes.ts`.

## 3. Immutability by default

Mutate only where the language idiom and the measured cost say to.

```ts
const updatedUser  = { ...user, name: nextName };
const updatedItems = [...items, newItem];
```

The reason is not purity - it is that shared mutable state produces bugs that reproduce
only under timing, and those are the expensive ones. In React it is stricter still: a
mutated object keeps its identity, so nothing re-renders and the bug presents as "the UI
is stale", miles from its cause.

Sorting is the trap worth naming, because it is silent: `Array.prototype.sort` sorts **in
place**. `[...items].sort(...)` - copy first, always.

Where mutation is genuinely the right call, say so:

```ts
// Deliberate mutation: this array is local, and the copy showed up in the profile.
buffer.push(chunk);
```

## 4. Errors

**Never swallow one.** Every `catch` does exactly one of three things, and which one is a
decision you make on purpose:

1. **Handles it meaningfully** - retries, falls back to a stated alternative, or
   translates it into a domain error the caller can act on.
2. **Enriches and rethrows**, adding the context the original lacked.
3. **Is a documented deliberate no-op**, with a comment saying why nothing is the right
   answer.

An empty catch, or one that logs and continues as though nothing happened, converts a
loud failure into a silent wrong answer. That is strictly worse: a crash gets fixed.

Check the failure the API actually gives you. `fetch` does not throw on a 404 - a missing
`response.ok` check is the most common instance of this bug in JavaScript.

```ts
const response = await fetch(url);
if (!response.ok) {
  throw new HttpError(`${response.status} ${response.statusText}`, { url });
}
```

Error messages are read by whoever is on call. Include what was being attempted and with
what input; never include a secret, a token, or a full request body that might hold one.

## 5. Async

Independent awaits run together. Sequentially awaiting things that do not depend on each
other is a latency bug no test will fail on:

```ts
const [users, markets, stats] = await Promise.all([fetchUsers(), fetchMarkets(), fetchStats()]);
```

Use `Promise.allSettled` when one failure should not lose the others' results - and then
actually handle the rejected entries rather than filtering them away.

Never leave a promise unawaited by accident. A floating promise's rejection is an
unhandled rejection, which is a crash or a silent loss depending on the runtime. If a
call is genuinely fire-and-forget, make that explicit and attach a catch.

## 6. Types

`any` disables the checker exactly where you needed it. Prefer `unknown` at a boundary
and narrow it; prefer a union of literals over a bare `string` when the set is closed.

```ts
interface Market {
  id: string;
  name: string;
  status: 'active' | 'resolved' | 'closed';   // not string
  createdAt: Date;
}
```

**Validate at the trust boundary, then trust the type inside it.** Data arriving from a
network, a file, an environment variable or a user is `unknown` until a schema has
checked it - a TypeScript interface is a compile-time claim, not a runtime guarantee, and
believing otherwise is how malformed input reaches the database.

## 7. Constants over magic values

Any number, string or limit that carries meaning gets a name, in the one constants home
the component already uses.

```ts
const MAX_RETRIES = 3;
const DEBOUNCE_DELAY_MS = 500;
```

Two failures this prevents: a reader cannot tell what `3` meant, and a value duplicated
across three files gets updated in two.

## 8. Comments

Comment the **why**, never the what. `// increment the counter` above `count++` is noise
that will outlive its own accuracy.

Worth writing:

```ts
// Exponential backoff: the upstream rate-limits aggressively during incidents, and a
// fixed retry interval turned a partial outage into a full one last quarter.
const delayMs = Math.min(BASE_DELAY_MS * 2 ** retryCount, MAX_DELAY_MS);
```

A comment describing behaviour the code no longer has is worse than no comment, because
it is believed. When you change code, change the comment above it in the same edit or
delete it.

Public APIs - anything another module or another team calls - get a doc comment covering
parameters, the return, what it throws, and one example. Internal helpers usually do not
need one; a good name has already done that work.

## 9. Shape of a function

- **Guard clauses over nesting.** Handle the exits first and let the happy path run
  unindented. Five levels of `if` is a function with three functions inside it.
- **One responsibility.** If describing it needs "and", split it.
- **Length is a symptom, not the disease** - but a function past roughly 50 lines, or a
  file past 300 (hard fail at 400), reliably has a seam in it. Find the seam rather than
  cutting at the line count.
- **Return early, return one shape.** A function that returns an object, or `null`, or
  throws, forces three code paths on every caller.

## 10. Tests

Arrange, Act, Assert - visibly, in that order, with blank lines between them.

**Test names state the behaviour and the condition**, because the name is what you read
when it fails in CI six months from now:

```
returns an empty array when no market matches the query
throws when the API key is missing
falls back to substring search when the cache is unavailable
```

Not `works`, not `test search`, not `it should work correctly`.

One behaviour per test. A test asserting five things reports the first failure and hides
the rest. Assert on observable behaviour, not on internal calls - a test asserting that a
private method was invoked fails on every refactor and catches no bugs.

## 11. Data and queries

Select the columns you need, not `*` - it moves bytes nobody uses and it changes silently
when the schema gains a column. Paginate anything that can grow. Never build a query by
string concatenation with user input; parameterise, in every language, every time.

## 12. The smells, and what each one is telling you

| Smell | What it means |
|---|---|
| a file named `utils` or `helpers` | no single responsibility - it will grow forever |
| a function over ~50 lines | there is a seam in it, and it has a name |
| five levels of nesting | the guard clauses were never written |
| a magic number | someone will change it in two of the three places |
| a boolean parameter | the function does two things; make it two functions |
| a comment explaining a line | the name is wrong, or the line is too clever |
| an empty catch | a real failure has been converted into a wrong answer |
| a mocked private method in a test | the test is coupled to structure, not behaviour |
| the same conditional in three files | the abstraction is missing, and one copy will be missed |
| `any` at a boundary | validation is missing, not merely typing |

## 13. What this forbids

1. **Never swallow an error.** Handle it, enrich and rethrow it, or document the no-op.
2. **Never ship `any` at a trust boundary.** Validate, then trust.
3. **Never mutate shared state** without a stated reason in a comment.
4. **Never weaken or delete a test to make a suite pass.** Fix the cause.
5. **Never leave a comment the code has outgrown.**
6. **Never introduce an abstraction on its second occurrence** - wait until its shape is
   visible.
7. **Never depart from a repository convention silently.** Departing is allowed; doing it
   without saying why is not.
