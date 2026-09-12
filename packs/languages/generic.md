# Pack: Generic

Loaded when no language pack matches. An unrecognised stack is never a reason to skip a
review, a test, or a build fix.

## Method

**Learn the conventions from the repository itself.** Read three or four files near the
change and extract: directory layout, naming, error handling, validation placement, test
location and style, and how dependencies are declared. Those conventions outrank every
default - consistency with the surrounding code is what matters.

**Find the test runner** from the build file, the CI config, or the existing test files.
Run it before and after the change.

**Find the build and lint commands** the same way, and use exactly what CI uses.

## Universal review focus

These hold in every language:

**Correctness.** Boundary conditions, empty and single-element cases, and the paths the
tests do not exercise. Conditions that are always true or unreachable.

**Absence.** Whatever this language calls nothing - null, nil, none, undefined, an empty
result - is handled everywhere it can occur.

**Errors.** Every failure path does something defensible. Nothing swallowed, no fallback
that masks a real failure, no error logged at a level nobody reads.

**Resources.** Anything opened is closed on every path including the failing one.
Nothing grows without bound.

**Concurrency.** Shared mutable state, check-then-use races, and assumptions about
ordering the runtime does not guarantee.

**Input.** External data validated at the boundary before it is trusted anywhere inside.

**Secrets.** Never hardcoded, never logged, never in a URL.

**Clarity.** Names that mislead, functions doing several unrelated things, and comments
that contradict the code.
