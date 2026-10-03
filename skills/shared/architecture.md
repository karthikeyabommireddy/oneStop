# Shared - Architecture: file roles and checks

For every phase that writes or reviews code. **Working is not the bar**: a feature that
passes its tests but fetches inside a leaf component, keeps business rules in a route
handler, or grows the same switch in three files has spent the next three features'
budget. The pattern to follow is the one your brief or the stack facts name; how it is
chosen is in `${CLAUDE_PLUGIN_ROOT}/skills/phase-design/references/pattern-binding.md`.

## Every file has one role

The role decides what it may import - checkable in a diff, unlike "this file is too big".

| Role | May import | May **never** import |
|---|---|---|
| **smart** (container) | data clients, stores, router, services, dumb components | - |
| **dumb** (presentational) | design tokens, other dumb components, pure utilities | data clients, stores, router, environment, clock, randomness |
| **service** | ports, domain models, pure utilities | framework request/response types, ORM sessions, concrete adapters, vendor SDKs |
| **adapter** | the port it implements, its vendor SDK, config | other adapters, transport types, unrelated services |
| **transport** | services, schemas, framework | repositories, the database |
| **pure** | other pure modules only | any I/O |

**Smart** knows where data comes from: fetching, mutations, state, routing, permissions, and
the loading, empty, error and unauthorised branches. It renders little markup itself - it
hands dumb children plain data and callbacks. One per route or feature area.

**Dumb** is props in, events out: the same props render the same output, so it runs in a
test or preview with nothing mocked. The tell that the boundary broke: React - a component
in `components/` using a data hook or `useRouter`; Angular - a dumb component injecting
anything (dumb ones are standalone, `OnPush`, signal inputs and outputs); Vue - a composable
called from a leaf SFC; Svelte - a store subscription in a leaf.

**Backend.** Transport parses and serialises. The service holds the rules and is
framework-free - no request, response or ORM session. The repository alone knows the
database or third-party API, behind an interface the service declares. Dependencies point
inward; wire concrete implementations at one composition root. `new PostgresOrderRepo()`
inside a service, or a connection singleton imported into the domain, welds the adapter in -
the proof of the fix is that the service's unit tests stop needing infrastructure.

## SOLID, as diff-level checks

Apply a principle only when its signal is in the diff, and name the signal.

| Principle | Look for | Fix |
|---|---|---|
| **SRP** | a `utils`/`helpers`/`manager` file, a name needing "and", a new file over 400 lines, a class whose methods split into two groups sharing no fields | extract along the seam the field usage shows |
| **OCP** | a switch on a type discriminator that grows a case per feature, especially the same switch in several files | map discriminator to handler, or polymorphism |
| **LSP** | an implementation throwing `NotImplemented`, an override narrowing input, `instanceof` on its own abstraction | split the interface so nobody refuses part of it |
| **ISP** | a twelve-method interface whose callers use two; test doubles stubbing eight methods | split by consumer |
| **DIP** | a service importing a driver or vendor SDK; `new Concrete()` in business logic; a unit test needing a database | declare the port where consumed, inject at the composition root |

These are diagnostics, not quotas: an interface with one implementation and no second in
prospect is speculative generality - itself a defect.

## Forbidden

1. A dumb file that fetches - the most common structural defect, and it costs the
   testability of everything above it.
2. A business rule in a route handler, or SQL in a service.
3. Claiming a principle was applied without naming the signal that made it relevant.
