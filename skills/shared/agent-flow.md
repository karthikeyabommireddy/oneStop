# Shared - Agent flow

Which agent runs in which phase, what it receives, and what it hands on. The source of
truth is the `phases:` frontmatter on each file in `${CLAUDE_PLUGIN_ROOT}/agents/`;
this is the consolidated view, and `${CLAUDE_PLUGIN_ROOT}/scripts/validate.py` checks
the two agree.

onestop's agents are **role agents**, not one agent per language. A `code-reviewer` that
loads the TypeScript and SQL packs is one review over a diff that spans both - not two
reviews that each see half of it. Adding a language is a pack, never a new agent.

---

## The flow

```
context -> requirements -> research -> discovery -> design -> ui-design -> plan
                                                                            |
                                                                       [ GATE 1 ]
                                                                            |
     +----------------------------------------------------------------------+
     v
  scaffold -> implement -> test -> automation -> qa-plan -> review -> compliance
                                                                        |
                                                                   [ GATE 2 ]
                                                                        |
                                                                      ship
```

Defect runs insert `reproduce` before `implement`. Performance runs insert `measure`
before and after. `verify-green` runs wherever the suite must be proven clean before
proceeding. Which phases run at all is the intent's `phase_mask`; **every phase that runs
has its own gate** - never a batched one.

## Phase to agent

| Phase | Primary agent | Also | Produces |
|---|---|---|---|
| context | *orchestrate, inline* | - | `.onestop/run.json`, `stack.yml`, `ledger.md` |
| requirements | `ba-analyst` | - | BRD, user stories, RTM |
| research | *orchestrate, inline* (context7) | - | `docs/research/<slug>/findings.md` |
| discovery | `discovery-scout` | `code-explorer`, `option-broker` | `.onestop/discovery/<slug>.md` |
| design | `architect` | `contract-agent`, `a11y-agent`, `option-broker` | system design, ADRs, contract |
| ui-design | `ui-designer` | `a11y-agent` | palette, tokens, component inventory |
| plan | `planner` | `architect`, `work-partitioner`, `option-broker` | plan.md, partition DAG |
| scaffold | `architect` | - | project structure per bound pattern |
| implement | `test-author` | `build-resolver`, `refactor-agent`, `performance-agent`, `ui-designer`, `merge-coordinator`, `docs-agent` | source + tests |
| test | `test-author` | - | unit and integration coverage |
| automation | `web-automation-agent` | `app-automation-agent` | e2e suites, CI wiring |
| qa-plan | `qa-planner` | - | manual test plan + CSV |
| review | `code-reviewer` | `security-reviewer`, `data-reviewer`, `a11y-agent`, `performance-agent`, `validator` | findings + verdict |
| compliance | `security-reviewer` | - | `docs/compliance/<slug>.md` |
| measure | `performance-agent` | - | baseline, profile, result |
| reproduce | `test-author` | `code-explorer` | the failing regression test |
| verify-green | `build-resolver` | `validator` | a green suite, or a named blocker |
| ship | `docs-agent` | `validator` | README, CHANGELOG, `.env.example` |

Reviewers are **bound by change surface, not chosen**: a diff touching migrations binds
`data-reviewer`; a diff touching one of the nine security triggers binds
`security-reviewer` at every size tier; a diff touching UI binds `a11y-agent`. Binding is
automatic and stated in one line - the user is never asked which reviewer to run.

## What every delegation carries

A subagent starts with no context. Brief it with exactly this, and nothing else:

1. **The task** and its acceptance criteria - one task, never the whole plan.
2. **Its write surface** - the files it owns. In a parallel wave this is a boundary, not
   a suggestion.
3. **The bound framework and pattern**, verbatim from the architecture protocol.
4. **The packs** it needs - language packs for the files in scope, concern packs for the
   surfaces touched.
5. **The contract**, if the design phase produced one.
6. **The discovery extract** relevant to this task - never the whole record.
7. **The edit-in-place rule, verbatim.**

## What every delegation returns

A summary, never file bodies:

```
<agent>
  did:      <what was done>
  files:    <written / modified - paths and counts, never contents>
  decisions:<anything decided that the brief did not cover>
  blocked:  <anything not completed, and exactly why>
```

Bodies never enter the main context. That discipline is what keeps a fifteen-phase run
inside one conversation.

## Parallel dispatch

When the partition produces a wave with two or more lanes, **dispatch every lane of that
wave in one message**. Lanes dispatched one per message run serially no matter what the
DAG said.

Join through `merge-coordinator` at every wave boundary - it verifies the combined state
and catches the semantic conflicts that a disjoint write-surface partition cannot
prevent, such as two lanes independently adding the same dependency at different
versions.

## Rules

1. **Never ask the user to pick an agent.** Binding is the orchestrator's job; that is
   the reason this plugin exists.
2. **Never run a phase without its gate**, and never batch two phases into one gate.
3. **Never delegate without the write surface** when a wave has more than one lane.
4. **Never let an agent return file bodies.**
5. **An agent whose phase did not run did not run.** Say so in the ledger rather than
   implying coverage that does not exist.
