# Reference - Binding the pattern, and the system design

For the design and scaffold phases. Every phase that writes code reads the file roles and
checks in `${CLAUDE_PLUGIN_ROOT}/skills/shared/architecture.md`; this is how the pattern
they follow gets chosen. Registry data: `${CLAUDE_PLUGIN_ROOT}/registry/patterns.json`.

## Bind the pattern, not just the framework

Two bindings happen, always, and both are announced:

| Binding | Source | Example |
|---|---|---|
| **Framework** | `${CLAUDE_PLUGIN_ROOT}/registry/stacks.json` | Playwright, FastAPI, React |
| **Pattern** | `${CLAUDE_PLUGIN_ROOT}/registry/patterns.json` | fixture-composed page objects, layered-ports, container/presentational |

Selection order, not negotiable:

1. **A pattern already in the repository wins.** Two patterns answering one concern is
   worse than either alone. Detect before you decide.
2. Otherwise bind the `default` for the detected framework.
3. Escalate to a `scale_up_from` pattern only when one of its `triggers` is objectively true
   in this repository, and write down which trigger fired. "It might grow" is not a trigger.
4. Ask the user only when two entries carry `equally_viable_when` and that condition holds.

State both bindings in one line before work starts, with the trigger if you escalated:

```
Bound: Playwright, fixture-composed page objects (parallel-safe, no BasePage god-object)
Bound: FastAPI, layered-ports (routes -> services -> repositories; domain framework-free)
Bound: hexagonal (trigger: HTTP + queue consumer over one domain)
```

## System design before code

At `standard` tier and above, the design phase produces `docs/design/<slug>/system-design.md`
before implementation starts - where the pattern, the data model and the failure modes are
decided while they are still cheap to change. At minimum: the component diagram; the bound
pattern and why; the data model with its constraints; the sequence for the primary flow; the
failure modes and what happens in each; the trade-offs, with the rejected option named.
Template: `${CLAUDE_PLUGIN_ROOT}/skills/phase-design/references/system-design-template.md`.

Decisions expensive to reverse get an ADR of their own; cheap ones do not.

## Forbidden

1. Binding a framework without binding its pattern.
2. Introducing a second pattern for a concern the repository already answers - migrating is
   its own planned task, never a side effect.
3. Adopting CQRS, hexagonal, feature-sliced or microservices without a fired trigger.
