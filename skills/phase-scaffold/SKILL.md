---
name: phase-scaffold
description: Stand up the first end-to-end vertical slice of a new project so every later slice has a working skeleton to extend. Loaded by the orchestrate skill for mvp intent.
version: 1.0.0
user-invocable: false
metadata:
  origin: onestop
  phase: scaffold
---

# Phase - Scaffold

Produce the thinnest thing that works end to end. Not a folder structure - a running
path from entry point to output, with one test proving it.

## What "End to End" Means Here

One real request travels the whole stack and comes back. For a web app that is a route
rendering real data from a real store. For a CLI it is a command parsing input and
producing output. For a service it is an endpoint returning a real response.

Everything after this extends a working system. That is the entire point: integration
problems surface on day one, when they are cheap, instead of at the end.

## Included

- The runtime skeleton and entry point.
- One vertical path through every layer the architecture declares.
- The data layer with one real model and its migration, if the project has a store.
- Configuration and secret loading, with `.env.example` covering every key.
- The test harness, with one test that exercises the vertical path.
- The build, run, and test commands, working and documented in the README.
- Lint and format config matching the ecosystem defaults.
- CI running build, lint, and test on push.

## Excluded

Do not build: features not in the first slice, abstractions with one implementation,
configuration for environments that do not exist yet, or a plugin system nobody asked
for. Speculative generality in a scaffold is the hardest thing to remove later.

## Structure

The scaffold is where the architecture becomes real - directories created now decide what
is easy for the life of the project, and getting them wrong compounds. Bind the pattern
from `${CLAUDE_PLUGIN_ROOT}/registry/patterns.json` and lay the tree out to match it.
Protocol: `${CLAUDE_PLUGIN_ROOT}/skills/shared/architecture.md`.

A backend scaffold separates transport, service and repository from the first commit -
`routes/`, `services/`, `repositories/`, with the composition root in the entry module.
A frontend scaffold separates smart from dumb - route or feature containers apart from a
presentational `components/` directory. Retro-fitting either boundary once features exist
is a refactor with no user-visible benefit, which is the kind that never gets scheduled.

Greenfield defaults to **modular-monolith** with honest internal boundaries. Do not start
from microservices, and do not add `ports/` and `adapters/` directories to a project with
one transport and one implementation of everything - that is the speculative generality
this phase is most prone to.

Create a directory only when something goes in it. An empty `utils/` is an invitation.

## Conventions

Follow the ecosystem defaults for layout and naming rather than inventing a structure.
A developer who knows the framework should recognise the project immediately. Use the
official generator where the framework has a good one, then adjust - do not hand-roll
what the ecosystem already standardises.

## Output

```
SCAFFOLD
  stack:     <declared stack per component>
  tree:      <directory structure - not file bodies>
  vertical:  <the path that works, entry to output>
  commands:  build / run / test, each verified to work
  ci:        <workflow created>
  verified:  <the test that proves the path, and its result>
```

## Rules

1. **It must run.** A scaffold that does not execute is a folder tree, not a scaffold.
2. **Verify every documented command** before handing off.
3. **One vertical slice, not a layer.**
4. **No speculative abstraction.**
5. **Never commit a real secret.** `.env.example` with placeholders only.
6. **Follow ecosystem conventions.**
