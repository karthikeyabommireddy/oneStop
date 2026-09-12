# The knowledge graph

onestop keeps a structural map of your repository so phases can ask *where* something is
instead of reading the codebase to find out. It is built by
[graphify](https://pypi.org/project/graphifyy/) and driven through `scripts/kg.sh`.

## Why

Reading a codebase from scratch on every run is the largest avoidable cost in an
orchestration pipeline, and it gets worse as the repo grows. The graph replaces the
search half of that work: it knows what exists, what calls what, and where each symbol
is defined. Phases then open only the handful of files the graph pointed at.

## Setup

```bash
pip install graphifyy==0.9.16
```

That is the whole setup. onestop builds the graph on its first run in a repository and
adds `graphify-out/` to `.gitignore`.

If graphify is not installed, onestop says so once and reads files directly. Everything
still works - it is just slower.

## Lifecycle

| When | What happens | Cost |
|---|---|---|
| First run in a repo | full build + report | slow, once |
| Every turn that changed source | `graphify update` via the `Stop` hook | ~1s, no LLM |
| A phase needs to locate something | `kg.sh explain` / `kg.sh path` | instant |

Each edit appends its path to `.onestop/kg-dirty`; the `Stop` hook does **one** refresh
per turn rather than one per edit. Non-source files (docs, lockfiles, config) are
filtered out - they do not move the graph.

## Commands

```bash
scripts/kg.sh status              # present? stale?
scripts/kg.sh build               # first build
scripts/kg.sh refresh             # incremental
scripts/kg.sh explain "login()"   # node, source location, every edge
scripts/kg.sh path "a()" "b()"    # shortest dependency path
scripts/kg.sh report              # the full report
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
source - not that it runs, not that it is correct, not that it is the only path.

It cannot see dynamic dispatch, reflection, string-based routing, dependency injection
or runtime registration. So:

> **Never conclude code is unused from graph degree alone.** That is exactly the mistake
> that deletes live code. Confirm a negative with a grep before stating it.

Use the graph to locate. Use the file to understand.

## Troubleshooting

**Empty graph after a build.** On Windows, a repository path beyond roughly 150
characters overflows the AST cache path and extraction fails silently, leaving no nodes.
`kg.sh` warns when your path is long. Move the repo somewhere shorter.

**Refresh failing.** onestop falls back to reading files and says so. Rebuild with
`kg.sh build`.

**Turning it off.** Set the `knowledge_graph` plugin setting to `off`. Phases read files
directly.
