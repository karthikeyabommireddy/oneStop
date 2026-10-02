---
name: phase-context
description: Establish what the repository is before any phase reasons about it - the detected stack, the project's own build, test and lint commands, the conventions, and the code knowledge graph - recorded once as stack facts every later specialist reads. Loaded by the orchestrate skill; not usually invoked directly.
version: 2.0.0
user-invocable: false
metadata:
  origin: onestop
  phase: context
---

# Phase - Context

Every specialist after this phase starts with an empty context. What this phase records
is what they know about the project. Get it right once, here, so nobody guesses it later.

## Who Does What

| Step | Done by | Result |
|---|---|---|
| Detect the stack | engine `detect_stack` | languages, frameworks, components, bound automation, ambiguities |
| Resolve the commands | engine `resolve_commands` | build, test, lint, format, typecheck, coverage - each with its source and confidence, plus the unknowns |
| Prepare the code graph | engine `kg` (`ensure`) | present, refreshed, building in the background, or skipped with the reason |
| Confirm and add conventions | `stack-adapter` | the stack facts file under `.onestop/reports/context/` |
| Settle unknown commands | orchestrator, once, at the context gate | the user's answer, recorded through `run_note` |

The orchestrator does not read the repository itself. It calls the engine, dispatches
the stack-adapter with the engine's brief, and stores the report.

## Command Resolution

The engine applies this order; the stack-adapter confirms the result:

1. **`onestop.yml`** at the repository root, `commands:` - the user's word, always wins.
2. **CI** - what the project's pipeline actually runs (`run:`, `script:`, `Jenkinsfile`).
3. **The task runner** - `package.json` scripts run with the lockfile's package manager,
   `Makefile`, `justfile`, `gradlew`/`mvnw`, `uv`/`poetry`, `tox`/`nox`.
4. **A registry default** - only when the stack entry declares what the command
   `requires` and every requirement is present.
5. **Ask** - once, at the context gate, every unknown in one question. Never guess.

A resolved command is not a confirmed one. The stack-adapter runs the test command once
when it is cheap and read-only, and reports the real outcome. A command nobody could
confirm is written down as unconfirmed, never as working.

## The Knowledge Graph

The graph is an accelerator, never a dependency. onestop is fully correct without it.

| Engine call | When |
|---|---|
| `kg {"action":"status"}` | installed? present? stale? building? |
| `kg {"action":"ensure"}` | every run: refresh if stale; start the first build in the background |
| `kg {"action":"build"}` | only after the user said yes at gate zero to building a large repository |

`ensure` does not build when the repository has more files than `ONESTOP_KG_MAX_FILES`
(default 5000), or when the `knowledge_graph` setting is `manual` or `off`. It returns
the reason instead, and the orchestrator offers the build at gate zero.

**Code-only by default.** The engine builds with `--code-only`: AST extraction on this
machine, nothing sent anywhere. graphify's semantic mode sends repository text to
whichever LLM provider it finds a key for, so onestop uses it only when the user sets
`ONESTOP_KG_SEMANTIC=1`.

**The user's `.gitignore` is never edited.** `graphify-out/` carries its own
`.gitignore` containing `*`.

**Refreshed at turn boundaries, never mid-phase.** An edit marks the graph dirty
(`.onestop/kg-dirty`); the Stop hook refreshes it in the background once per turn. A
specialist that just wrote a file already knows what it wrote.

### Querying

Specialists query the graph directly - read-only, local, instant:

```bash
graphify explain "<symbol>" --graph graphify-out/graph.json   # source location, type, every edge
graphify path "<a>" "<b>" --graph graphify-out/graph.json     # shortest dependency path
```

and read `graphify-out/GRAPH_REPORT.md` for the overview.

**Query the graph first. Read a file only when the graph cannot answer.**

| Question | Answer from |
|---|---|
| Does something like this already exist? | graph |
| What calls this, and what does it call? | graph |
| Where is this defined? | graph |
| What are the core abstractions here? | graph report - God Nodes |
| Are there import cycles? | graph report |
| What does this function actually do? | **read the file** |
| Is this logic correct? | **read the file** |
| What are the conventions in this code? | **read two or three sibling files** |

Reading three files the graph pointed at beats reading thirty to find them.

### Reading the Report

`graphify-out/GRAPH_REPORT.md`, in order of usefulness:

- **God Nodes** - the most connected symbols: the real core abstractions, whatever the
  directory names suggest. Start here on an unfamiliar codebase.
- **Surprising Connections** - edges that cross module boundaries unexpectedly. A change
  there has consequences nobody predicted.
- **Import Cycles** - existing cycles constrain where new code can live.
- **Communities** - clusters that change together. A community boundary is usually the
  right boundary for a new module.
- **Knowledge Gaps** - what extraction could not resolve. Unknown, not absent.

### Degrading Gracefully

- **graphify not installed** - the engine says so. Mention it once at gate zero
  (`pip install graphifyy==0.9.16`) and proceed by reading files. Never ask again in the
  same run.
- **Graph empty after a build** - on Windows a repository path beyond roughly 150
  characters overflows graphify's AST cache path. Report it and read files.
- **Refresh failed** - read files for the rest of the run, and say so. A stale graph that
  is silently trusted is worse than no graph.

### Trust Boundaries

The graph is **structural truth, not behavioural truth**. An edge means a call exists in
the source - not that it executes, not that it is correct, not that it is the only path.
Dynamic dispatch, reflection, string-based routing, dependency injection and runtime
registration are invisible to it. **Never conclude that something is unused from graph
degree alone** - that is exactly the mistake that deletes live code.

## The Stack Facts File

The stack-adapter writes it; every later brief points to it.

```
STACK FACTS
  stack:        <languages, frameworks, components - with the marker that proved each>
  commands:     <name> = <command>   (<source>, confirmed | unconfirmed)
  toolchain:    <package manager, pinned runtime and framework versions>
  conventions:  <layout, naming, error handling, configuration and secrets loading>
  tests:        <unit / integration / end-to-end locations and frameworks>
  ci:           <system, and the jobs that run on pull requests>
  architecture: <the pattern the repository already demonstrates>
  graph:        <present | refreshed | building | absent - with the reason>
```

## Gate

The context gate shows the stack in one line, the resolved commands with their sources,
and every unknown command as one question. Nothing later may run a command the user has
not seen here or declared in `onestop.yml`.

## Rules

1. **The engine detects, the stack-adapter confirms, nobody guesses.**
2. **Never invent a command.** Unknown commands go to the user once, together.
3. **Report what the project pins.** Never recommend a different version here.
4. **Query before reading.**
5. **Never treat the graph as behavioural truth**, and never call code dead from it.
6. **Never block on a missing or broken graph.** Say so and read files.
7. **Edit no project file.** The only write is the stack facts file under
   `.onestop/reports/context/`.
