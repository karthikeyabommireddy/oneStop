---
name: phase-context
description: Build, refresh and query the repository knowledge graph so later phases get targeted context instead of re-reading the codebase. Runs inside orchestrate Step 0 and is queried by discovery. Loaded by the orchestrate skill; not usually invoked directly.
version: 1.0.0
user-invocable: false
metadata:
  origin: onestop
  phase: context
---

# Phase - Context (knowledge graph)

Reading a codebase from scratch on every run is the largest avoidable cost in this
pipeline. The knowledge graph replaces most of that reading with targeted queries.

The graph is built by `graphify` and driven through `${CLAUDE_PLUGIN_ROOT}/scripts/kg.sh`, which wraps the
exact commands verified against graphify 0.9.16.

## The Rule

**Query the graph first. Read a file only when the graph cannot answer.**

The graph tells you what exists, what calls what, where a symbol is defined, and which
modules cluster together. It does not tell you what a function body actually does. So:

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

Reading three files the graph pointed you at beats reading thirty to find them.

## Commands

```bash
${CLAUDE_PLUGIN_ROOT}/scripts/kg.sh status              # present? stale?
${CLAUDE_PLUGIN_ROOT}/scripts/kg.sh build               # first build (slow, once per repo)
${CLAUDE_PLUGIN_ROOT}/scripts/kg.sh refresh             # incremental, no LLM, about a second
${CLAUDE_PLUGIN_ROOT}/scripts/kg.sh explain "login()"   # one node: source location, type, every edge
${CLAUDE_PLUGIN_ROOT}/scripts/kg.sh path "a()" "b()"    # shortest dependency path
${CLAUDE_PLUGIN_ROOT}/scripts/kg.sh report              # the full graph report
${CLAUDE_PLUGIN_ROOT}/scripts/kg.sh ensure              # build if missing, refresh if dirty
```

## When It Runs

**First run in a repository** - `kg.sh build`. This is the only slow one. It writes
`graphify-out/` and adds it to `.gitignore`.

**After every turn that changed source** - handled automatically by the `Stop` hook. Each
edit appends to `.onestop/kg-dirty`; the hook does one `graphify update` per turn rather
than one per edit. No LLM call, roughly a second.

**Never mid-phase.** The graph is refreshed at turn boundaries, not between agents. An
agent that just wrote a file already knows what it wrote.

## Reading the Report

`graphify-out/GRAPH_REPORT.md` gives, in order of usefulness:

- **God Nodes** - the most connected symbols. These are the real core abstractions,
  regardless of what the directory names suggest. Start here on an unfamiliar codebase.
- **Surprising Connections** - edges that cross module boundaries unexpectedly. These
  are where a change will have consequences nobody predicted.
- **Import Cycles** - existing cycles constrain where new code can live.
- **Communities** - clusters that change together. A community boundary is usually the
  right boundary for a new module.
- **Knowledge Gaps** - what the extraction could not resolve. Treat these as unknown,
  not as absent.

## Degrading Gracefully

The graph is an accelerator, never a dependency. onestop is fully correct without it.

- **graphify not installed** - say so once, offer `pip install graphifyy==0.9.16`, and
  proceed by reading files. Do not ask again in the same conversation.
- **Graph empty after a build** - on Windows a repository path beyond roughly 150
  characters overflows the AST cache path and produces an empty graph. `kg.sh` warns
  about this. Report it and fall back to reading files.
- **Refresh failed** - fall back to reading files for the rest of the run, and say so.
  A stale graph that is silently trusted is worse than no graph.

## Trust Boundaries

The graph is **structural truth, not behavioural truth**. It is extracted from the AST,
so an edge means a call exists in the source - not that it executes, not that it is
correct, and not that it is the only path.

Dynamic dispatch, reflection, string-based routing, dependency injection and runtime
registration are invisible to it. **Never conclude that something is unused from graph
degree alone** - that is exactly the mistake that deletes live code.

## Output

```
CONTEXT
  graph:   <built | refreshed | absent, with the reason>
  scale:   <nodes, edges, communities>
  core:    <the God Nodes relevant to this request>
  related: <existing symbols the graph links to this work, with source locations>
  cycles:  <any that constrain the change>
  gaps:    <what the extraction could not resolve>
  read:    <files opened directly, and why the graph could not answer>
```

## Rules

1. **Query before reading.** Every file opened that the graph could have located is
   waste.
2. **Never treat the graph as behavioural truth.** Structure only.
3. **Never conclude code is dead from the graph alone.**
4. **Refresh at turn boundaries**, never mid-phase.
5. **Never block on a missing or broken graph.** Say so and read files.
6. **State what you read directly and why**, so the cost is visible.
