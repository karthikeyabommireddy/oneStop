---
name: phase-scaffold
description: Stand up the first end-to-end vertical slice of a new project from the ecosystem's official generator, at the language, framework and versions the user chose, so every later slice has a working skeleton to extend. Loaded by the orchestrate skill for mvp intent.
version: 2.0.0
user-invocable: false
metadata:
  origin: onestop
  phase: scaffold
---

# Phase - Scaffold

Produce the thinnest thing that works end to end. Not a folder structure - a running
path from entry point to output, with one test proving it.

## Preconditions - the User's Choices

The scaffold builds what the user chose. It never chooses. Before this phase, the run
records:

| Choice | Made at |
|---|---|
| language or runtime, and framework | gate zero (the greenfield question) |
| exact versions of each | the research gate, from versions the researcher verified on the registry that day |
| initialise a git repository here | gate zero |
| CI system - GitHub Actions, GitLab CI, Azure Pipelines, or none | the research gate, when the repository has none |

Any choice missing from the brief: the architect returns it under `open:` with a
recommendation and writes nothing. A professional default is a recommendation, never a
decision.

## Dispatch

`architect` in scaffold mode - the one mode in which it writes project files. Generators
run non-interactively, with every answer passed as a flag: a specialist cannot answer a
prompt, and a generator waiting on stdin hangs the phase.

## Generate, Then Adjust

**1. Run the ecosystem's official generator, pinned to the chosen version** - never
`@latest`, never an unpinned template.

| Ecosystem | Generator |
|---|---|
| Vite (React, Vue, Svelte) | `npm create vite@<version> <name> -- --template <template>` |
| Next.js | `npx create-next-app@<version> <name>` with the flags for every prompt |
| .NET | `dotnet new <template> -n <Name> --framework <tfm>` |
| Go | `go mod init <module>`, then `cmd/<name>/` and `internal/` |
| Rust | `cargo new <name>` or `cargo new --lib <name>` |
| Python | `uv init <name>` or `poetry new <name>` |
| Spring Boot | Spring Initializr (start.spring.io) at the chosen Boot version |
| Flutter | `flutter create <name>` |

A generator installs its own template's dependencies - they are part of the stack the user
approved. Any package beyond the template is a new dependency: it needs its own approval,
and the guard refuses the install without one.

**2. Adjust to the bound pattern.** Lay the tree out as the generator does, then add only
the layer directories the pattern from `${CLAUDE_PLUGIN_ROOT}/registry/patterns.json`
requires. Protocol: `${CLAUDE_PLUGIN_ROOT}/skills/shared/architecture.md`.

| Pattern | Layers from the first commit |
|---|---|
| layered service (web API) | transport, service and repository apart, composition root in the entry module |
| smart/dumb UI | route or feature containers apart from presentational components |
| library or CLI | the ecosystem layout - Go `cmd/` + `internal/`, Rust `lib.rs` + `main.rs`, .NET `src/` + `tests/`, Python `src/<pkg>/` + `tests/`; I/O at the edges, the core pure |
| platform MVVM (mobile, desktop) | views apart from view models; platform services behind interfaces |

Retro-fitting a boundary once features exist is a refactor with no user-visible benefit -
the kind that never gets scheduled.

Greenfield defaults to a **modular monolith** with honest internal boundaries. Do not
start from microservices, and do not add `ports/` and `adapters/` to a project with one
transport and one implementation of everything - that is the speculative generality this
phase is most prone to. Create a directory only when something goes in it.

## What "End to End" Means Here

One real request travels the whole stack and comes back. For a web app, a route rendering
real data from a real store. For a CLI, a command parsing input and producing output. For
a service, an endpoint returning a real response. Integration problems surface on day one,
when they are cheap, instead of at the end.

## Included

- The runtime skeleton and entry point, from the generator.
- One vertical path through every layer the pattern declares.
- The data layer with one real model and its migration, if the project has a store.
- Configuration and secret loading in the ecosystem's convention, with every key
  documented: dotenv and `.env.example` for Node and Python; `appsettings.json` plus
  user-secrets for .NET; `application-<profile>` files for Spring; flags and environment
  variables for Go and Rust.
- The test harness, with one test that exercises the vertical path.
- Build, run and test commands, working, and written to `onestop.yml` `commands:` and the
  README.
- Lint and format configuration at the ecosystem defaults.
- CI in the system the user chose, running build, lint and test on pull requests. None
  chosen means no CI file.
- `git init` only if the user said yes at gate zero. Nothing is committed here - the
  first commit happens at the ship gate, like every other.

## Excluded

Features not in the first slice, abstractions with one implementation, configuration for
environments that do not exist yet, a plugin system nobody asked for. Speculative
generality in a scaffold is the hardest thing to remove later.

## Report

```
SCAFFOLD
  stack:     <language, framework and the exact versions the user chose>
  generator: <the exact command run>
  tree:      <directory structure - never file bodies>
  vertical:  <the path that works, entry to output>
  commands:  build / run / test, each verified to work
  ci:        <the workflow written, in the chosen system - or none>
  verified:  <the test that proves the path, and its result>
```

## Rules

1. **Never choose a language, framework or version.** Missing means `open:`, not a default.
2. **The official generator at the chosen version.** Never `@latest`, never hand-rolled
   where the ecosystem standardises.
3. **It must run.** A scaffold that does not execute is a folder tree, not a scaffold.
4. **Verify every documented command** before handing off.
5. **One vertical slice, not a layer.** No speculative abstraction.
6. **Never commit a real secret.** Placeholders only, in the ecosystem's convention.
