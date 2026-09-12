# Shared - Architecture protocol

Loaded by every phase that designs, writes or reviews code. The registry data behind it
is `${CLAUDE_PLUGIN_ROOT}/registry/patterns.json`; this file is how to apply it.

The rule this protocol exists to enforce: **working is not the bar.** A feature that
passes its tests but puts fetching inside a leaf component, business rules inside a route
handler, and a growing switch in three files has consumed the budget for the next three
features. Structure is part of the deliverable, and it is decided before the code is
written, never retrofitted after.

---

## 1. Bind the pattern, not just the framework

Two bindings happen, always, and both are announced:

| Binding | Source | Example |
|---|---|---|
| **Framework** | `${CLAUDE_PLUGIN_ROOT}/registry/stacks.json` | Playwright, FastAPI, React |
| **Pattern** | `${CLAUDE_PLUGIN_ROOT}/registry/patterns.json` | fixture-composed page objects, layered-ports, container/presentational |

Selection order, and it is not negotiable:

1. **A pattern already in the repository wins.** Always. Two patterns answering one
   concern is worse than either alone - a reader now has to know which files follow
   which rule. Detect before you decide.
2. Otherwise bind the `default` for the detected framework.
3. Escalate to a `scale_up_from` pattern **only** when one of its `triggers` is
   objectively true in this repo. Write down which trigger fired. "It might grow" is not
   a trigger; it is the reason most codebases carry an abstraction nobody needed.
4. Ask the user only when two entries carry `equally_viable_when` and that condition
   actually holds.

State both bindings in one line before work starts:

```
Bound: Playwright, fixture-composed page objects (parallel-safe, no BasePage god-object)
Bound: FastAPI, layered-ports (routes -> services -> repositories; domain framework-free)
```

If you escalated, the line says why: `hexagonal (trigger: HTTP + queue consumer over one domain)`.

---

## 2. Smart and dumb files

Every file written gets exactly one **role**, and the role decides what it may import.
This is the whole mechanism - the import list is checkable in a diff, "is this component
too big" is not.

| Role | May import | May **never** import |
|---|---|---|
| **smart** (container) | data clients, stores, router, services, dumb components | - |
| **dumb** (presentational) | design tokens, other dumb components, pure utilities | data clients, stores, router, environment, clock, randomness |
| **service** | ports, domain models, pure utilities | framework request/response types, ORM sessions, concrete adapters, vendor SDKs |
| **adapter** | the port it implements, its vendor SDK, config | other adapters, transport types, unrelated services |
| **transport** | services, schemas, framework | repositories, the database |
| **pure** | other pure modules only | any I/O whatsoever |

### The split, concretely

**Smart** knows *where data comes from*. It owns fetching, mutations, store and global
state, routing, permissions, and the loading / empty / error / unauthorised branches. It
renders almost no markup of its own - it composes dumb children and hands them plain data
and callbacks. Budget: one per route or feature area. A second smart component on the
same screen usually means the feature wants splitting.

**Dumb** is props in, events out. Given the same props it renders the same output, so it
can be rendered in a test or a preview with **nothing mocked**. That property is the
entire point: it is what makes UI testable without a network stub, and it is the
precondition for component previews and design-system extraction.

Per framework, the tell that the boundary broke:

- **React** - a component in `components/` importing a data hook or `useRouter`.
- **Angular** - a dumb component with a constructor injection or an `inject()` call. Dumb
  components are standalone, `OnPush`, and take signal `input()` / `output()` only.
- **Vue** - a composable called from a leaf SFC. Logic lives in `composables/`, invoked
  by the container.
- **Svelte** - a store subscription in a leaf. Runes in the route; props down.
- **React Native** - same rule, and it is what lets one component render under both the
  iOS and Android snapshot suites.

### Backend equivalent

Same idea, different names. Transport parses and serialises. Service holds the rules and
is framework-free - **no request object, no response object, no ORM session**. Repository
is the only layer that knows the database or a third-party API, behind an interface the
*service* declares.

Dependency direction is inward and never reverses. The two failures that silently undo
it:

- `new PostgresOrderRepo()` inside a service - the adapter is now welded in, and the
  service cannot be tested without a database.
- A module-level connection singleton imported into the domain - same welding, harder to
  see.

Wire concrete implementations at **one composition root**. The proof it worked is that
the service's unit tests stop needing infrastructure.

---

## 3. SOLID, as diff-level checks

Citing SOLID in a review comment changes nothing. Each principle below is a thing you can
look for in a diff. Full detail with fixes:
`${CLAUDE_PLUGIN_ROOT}/registry/patterns.json` -> `solid`.

| Principle | Look for | Fix |
|---|---|---|
| **SRP** | a file named `utils` / `helpers` / `manager`, a name needing "and", a file over 400 lines, a class whose methods split into two groups sharing no fields | extract along the seam the field usage already shows |
| **OCP** | a switch on a type discriminator that grew a case per feature - especially the *same* switch in more than one file | map discriminator to handler, or polymorphism |
| **LSP** | an implementation throwing `NotImplemented`, an override narrowing input, a caller doing `instanceof` on its own abstraction | split the interface so nobody has to refuse part of it |
| **ISP** | a twelve-method interface whose callers use two; test doubles stubbing eight methods to exercise one | split by consumer - the stub count measures how wrong the width is |
| **DIP** | a service importing a driver or vendor SDK; `new Concrete()` in business logic; a unit test needing a database | declare the port where consumed, inject at the composition root |

**These are diagnostics, not quotas.** A two-file script needs no ports layer. An
interface with one implementation and no second in prospect is speculative generality -
itself a defect. Apply a principle when its signal is actually present in the diff, and
say which signal you saw.

---

## 4. System design before code

At `standard` tier and above, the design phase produces `docs/design/<slug>/system-design.md`
before implementation starts. It is not a formality - it is where the pattern binding, the
data model and the failure modes get decided while they are still cheap to change.

It must contain, at minimum: the component diagram; the bound architecture pattern and the
reason; the data model with its constraints; the sequence for the primary flow; the failure
modes and what happens in each; and the trade-offs considered with the rejected option
named. Template: `${CLAUDE_PLUGIN_ROOT}/skills/phase-design/references/system-design-template.md`.

Decisions expensive to reverse get an ADR of their own. Decisions cheap to reverse do not -
an ADR per variable name is how the directory becomes unreadable.

---

## 5. What this protocol forbids

1. **Never bind a framework without binding its pattern.** Half a decision produces a
   suite or a service that works today and is rewritten in a quarter.
2. **Never introduce a second pattern** for a concern the repo already answers. Migrating
   is its own planned task, never a side effect.
3. **Never let a dumb file fetch.** It is the single most common structural defect and it
   costs the testability of everything above it.
4. **Never put a business rule in a route handler**, and never put SQL in a service. Each
   is how layered-ports degrades back into the fat controller it replaced.
5. **Never adopt CQRS, hexagonal, feature-sliced or microservices without a fired
   trigger.** Absence of a trigger is a sufficient, statable reason to say no.
6. **Never claim a principle was applied without naming the signal** that made it
   relevant.
