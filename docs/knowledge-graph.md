# The Knowledge Graph

onestop keeps a structural map of your repository so specialists can ask *where*
something is instead of reading the codebase to find out. It is built by
[graphify](https://pypi.org/project/graphifyy/) and managed by the onestop engine.

## Why

Reading a codebase from scratch on every run is the largest avoidable cost in an
orchestration pipeline, and it grows with the repository. The graph replaces the search
half of that work: it knows what exists, what calls what, and where each symbol is
defined. Specialists then open only the handful of files the graph pointed at.

## Setup

```bash
pip install graphifyy==0.9.16
```

That is the whole setup. Without graphify, onestop says so once at gate zero and
specialists read files directly. Everything still works - it is slower.

## Nothing leaves your machine

The engine builds the graph **code-only**: local AST extraction, no network, no API key.

graphify also has a semantic mode that reads documentation and sends repository text to
whichever LLM provider it finds a key for - `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`,
`GEMINI_API_KEY` and others - billed to that key. onestop never uses it unless you opt in:

```bash
export ONESTOP_KG_SEMANTIC=1     # sends repository text to your LLM provider
```

## Lifecycle

| When | What happens | Cost |
|---|---|---|
| First run in a repository | the engine starts a build in the background; the run continues without the graph until it finishes | once |
| A repository over 5,000 files | the build is offered at gate zero instead of started (`ONESTOP_KG_MAX_FILES` changes the limit) | - |
| Every turn that changed source | the Stop hook runs `graphify update` in the background, once per turn | about a second, no LLM |
| A specialist needs to locate something | it queries the graph directly | instant |

`graphify-out/` carries its own `.gitignore` containing `*`, so the graph never appears in
your diff - and your own `.gitignore` is never edited.

## Queries

Specialists run these themselves:

```bash
graphify explain "login()" --graph graphify-out/graph.json    # one node: location, type, every edge
graphify path "a()" "b()" --graph graphify-out/graph.json     # shortest dependency path
```

## Reading the report

`graphify-out/GRAPH_REPORT.md`, most useful first:

- **God Nodes** - the most connected symbols. The real core abstractions, whatever the
  directory names suggest. Start here in an unfamiliar codebase.
- **Surprising Connections** - edges crossing module boundaries unexpectedly. Where a
  change will have consequences nobody predicted.
- **Import Cycles** - existing cycles constrain where new code can live.
- **Communities** - clusters that change together; usually the right boundary for a new
  module.
- **Knowledge Gaps** - what extraction could not resolve. Unknown, not absent.

## What the graph is not

**It is structural truth, not behavioural truth.** An edge means a call exists in the
source - not that it runs, not that it is correct, not that it is the only path. It cannot
see dynamic dispatch, reflection, string-based routing, dependency injection or runtime
registration.

> **Never conclude code is unused from graph degree alone.** That is exactly the mistake
> that deletes live code. Confirm a negative with a search before stating it.

Use the graph to locate. Use the file to understand.

## Settings

| `knowledge_graph` | Behaviour |
|---|---|
| `auto` (default) | build on first use, refresh after every turn that changed code |
| `manual` | build and refresh only when you ask |
| `off` | never - specialists read files directly |

## Troubleshooting

**Empty graph after a build.** On Windows, a repository path beyond roughly 150
characters overflows graphify's cache path and extraction leaves no nodes. Move the
repository somewhere shorter.

**A refresh failed.** onestop says so and reads files for the rest of the run. The next
successful build replaces the stale graph.
