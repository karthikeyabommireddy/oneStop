# Shared - Coding Standards

The line-level floor for every file onestop writes, checked in every review. Architecture
(how the system is shaped) is `architecture.md`; what is idiomatic in a language is its
pack, which shows the examples. When a pack disagrees with this file, the pack wins; when
the repository disagrees with the pack, the repository wins - a change that is correct but
foreign is still a change the team has to live with.

## Principles

- **Readability first.** Code is read far more than it is written, often under pressure
  by someone who did not write it. A clear name beats a clever construction.
- **KISS.** The simplest thing that works - not the most general. Generality no current
  caller needs is speculative work with a maintenance bill.
- **DRY, three strikes.** The wrong abstraction costs more than duplication: duplicate once
  without ceremony, extract on the third occurrence, when its shape is visible.
- **YAGNI.** An interface with one implementation and no second in prospect, a config
  option nothing sets, a plugin system for one plugin - each is a defect that looks like
  foresight.

## Naming

- Variables describe the value, never its type or position (`marketSearchQuery`, not `q`).
- Functions are verb-first (`fetchMarketData`, `isValidEmail`); a noun-named function hides
  that work happens.
- Booleans ask a question: `is`, `has`, `should`, `can`.
- Numbers carry their units: `delayMs`, `timeoutSeconds`, `priceCents`.
- No category names - `utils`, `helpers`, `manager`, `common` have no single responsibility.
- Match the surrounding convention for casing and file names.

## Immutability

Mutate only where the language idiom and the measured cost say to. Shared mutable state
produces bugs that reproduce only under timing - the expensive kind. Copy before an
in-place operation on data other code holds. Where mutation is the right call, say why in a
comment.

## Errors

Never swallow one. Every handler does one of three things on purpose: handles it
meaningfully (retry, a stated fallback, a domain error the caller can act on), enriches and
rethrows, or is a documented deliberate no-op. Check the failure the API actually reports -
a non-success status or an error value that does not throw. Messages say what was being
attempted and with what input; never a secret, a token or a full request body.

## Async

Independent operations run together; awaiting them one by one is a latency bug no test
fails on. When one failure must not lose the others' results, collect all outcomes and
handle every failure. Never leave an operation unawaited by accident; fire-and-forget is
explicit and still handles its failure.

## Types

Validate at the trust boundary, then trust the type inside it. Network, file, environment
and user input is unknown until a schema has checked it - a static type is a compile-time
claim, not a runtime guarantee. Prefer a closed set of values over a free string when the
set is closed.

## Constants

Any number, string or limit that carries meaning gets a name, in the one constants home the
component already uses. A value duplicated across three files gets updated in two.

## Comments

Comment the why, never the what. A comment the code has outgrown is worse than none,
because it is believed: change or delete it in the same edit as the code. Public APIs get a
doc comment covering parameters, return, failures and one example.

## Functions

Guard clauses over nesting. One responsibility - if describing it needs "and", split it.
Return one shape. A function past about 50 lines, or a new file past 300 (flagged at 400
unless the repository's lint rule says otherwise), has a seam in it; find the seam.
Generated files, migrations and snapshots are exempt.

## Tests

Arrange, Act, Assert, visibly. Names state behaviour and condition ("returns an empty list
when no market matches"). One behaviour per test, asserted through observable behaviour -
never a mocked private method.

## Data

Select the columns you need, paginate anything that grows, and never build a query by
concatenating user input - parameterise, in every language.

## Smells

| Smell | What it means |
|---|---|
| a file named `utils` or `helpers` | no single responsibility |
| a function over ~50 lines | a seam with a name |
| five levels of nesting | guard clauses never written |
| a magic number | changed in two of three places, eventually |
| a boolean parameter | two functions sharing a name |
| a comment explaining a line | the name is wrong, or the line too clever |
| an empty catch | a real failure turned into a wrong answer |
| the same conditional in three files | a missing abstraction |
| an untyped value at a boundary | missing validation |

## Forbidden

1. Swallowing an error.
2. An unvalidated value at a trust boundary.
3. Mutating shared state without a stated reason.
4. Weakening or deleting a test to make a suite pass.
5. A comment the code has outgrown.
6. An abstraction on its second occurrence.
7. Departing from a repository convention without saying why.
