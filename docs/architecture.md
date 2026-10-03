# Architecture

**The orchestrator decides, code enforces the rules, people approve.**

onestop is a hub-and-spoke system. One orchestrator plans and delegates; specialists do
the work, each in its own context, and report back; a pipeline engine holds the state and
refuses anything out of order; hooks enforce the rules no prompt can be trusted to keep.
The developer approves every gate, makes every technology and version choice, and owns
git.

```
                                   developer
             approve gates · choose technologies and versions · own git
                                       │  AskUserQuestion
                                       ▼
   ┌───────────────────────────┐   MCP tools   ┌───────────────────────────────────────┐
   │ orchestrator              │ ────────────► │ pipeline engine (engine/server.mjs)    │
   │ skills/orchestrate        │ ◄──────────── │ ledger · gates · budgets · briefs      │
   │ plans, delegates,         │   recipes,    │ commands · checkpoints · undo          │
   │ explains, asks            │   briefs      └───────────────────▲───────────────────┘
   └─────────────┬─────────────┘                                   │ stores reports,
         brief   │  ▲ REPORT (≤ 25 lines)                          │ refuses what is
                 ▼  │                                              │ not allowed
   ┌────────────────────────────────────┐       ┌─────────────────┴──────────────────┐
   │ specialists (agents/*.md)          │ ────► │ hooks (engine/hooks.mjs)            │
   │ each in its own context            │ tools │ guard · write guard · report capture│
   │ one task, one brief, one report    │       │ security flags · graph refresh      │
   └────────────────────────────────────┘       └────────────────────────────────────┘
```

## The reference architecture, mapped

| Reference element | onestop | Where |
|---|---|---|
| Orchestrator agent - plans, delegates, explains, asks for approvals | The hub. Runs in your session, never does a phase's work, keeps only reports. | `skills/orchestrate/SKILL.md`, `commands/onestop.md` |
| Specialist agents | 27 role agents. Planner `planner`; developer `implementer`; tester `test-author`; reviewer `code-reviewer`; fixer `build-resolver`; security `security-reviewer`; docs `docs-agent`; DevOps `devops-agent`; designer `ui-designer` and `architect`. | `agents/` |
| A stack adapter called first | `stack-adapter` runs first, in the context phase, for every stack: it confirms the engine's detected stack and resolved commands and writes the stack facts every later specialist reads. | `agents/stack-adapter.md`, `engine/lib/stack.mjs` |
| Pipeline engine - state, gates, checkpoints, validation, code scan | An MCP server with 18 tools. Sole writer of the run ledger; enforces phase order, the authorising gate and retry budgets; builds every brief; checkpoints and undoes through a private git index. | `engine/server.mjs`, `engine/lib/` |
| Automatic checks - build, tests, analyzers, scanners, format | Hooks enforce the command and write guards and flag security surfaces in new code. Build, test, lint and format run inside every development loop with the project's own resolved commands; installed scanners run at review. | `hooks/hooks.json`, `engine/hooks.mjs`, `skills/phase-review` |
| Central agent warehouse - versioned agents, skills, hooks, policies, tests | This repository, released by version through the plugin marketplace: agents, skills, hooks, `registry/policies.json`, and the engine's test suite. | the repository, GitHub Releases |
| Development loop per module - code, build, review, test; failures fix and rework, up to N iterations, then a human decides | The implement phase: red test, code, build, review, test per module, in parallel lanes. Each fix attempt is counted by the engine; when a budget is spent the run blocks until you choose. | `registry/policies.json` (`dev_loop`, `retry_budget`), `loop_attempt` |
| Documentation, quality and security, including licensing | The review panel, the validator's verdict, the compliance phase, and `docs-agent` at ship. Every proposed package is reported with its licence, version and advisories before you approve it. | `skills/phase-review`, `agents/validator.md`, `agents/researcher.md` |
| Approve and deploy | The ship gate - commit locally, commit and push, commit, push and open a pull request, or leave uncommitted. Deploys are never run by onestop; the guard refuses them. | `skills/phase-ship`, `registry/policies.json` (`ship`) |
| The developer chooses technology and versions, approves gates, runs git | Gate zero asks language, framework and git for a new project; versions are chosen at the research gate from the registry, upgrades at the upgrade-plan gate; nothing reaches git except as chosen at ship. | `skills/orchestrate`, `skills/phase-upgrade-plan` |
| Branch protection - agents cannot push | The guard refuses any push the ship choice did not include, any push to the default branch, and any force-push. Server-side branch protection remains recommended. | `engine/lib/guard.mjs` |

## One phase, end to end

1. **`phase_start`** - the engine checks order and authorisation, takes the baseline
   checkpoint on the run's first phase, and returns the **recipe**: who leads, how they are
   dispatched (single, per unit, per target, panel or development loop), which reviewers
   bind and why, the playbook and the artifacts.
2. **`brief`** - for each dispatch, the engine builds the brief: the task, the files to
   read first, the resolved commands, the write surface, the budget, the safety invariants
   verbatim, and the exact report to return. The orchestrator passes it unchanged.
3. **Dispatch** - parallel dispatches go out in one message, or they are not parallel.
4. **Report capture** - when a specialist finishes, the SubagentStop hook stores its
   report in the ledger. A specialist that forgot the REPORT block is sent back once.
   Every `open:` item becomes an open question on the run.
5. **`phase_finish`** - refused if no report was stored. Takes a checkpoint if the phase
   wrote files. Stops for a gate when the gate mode says so, **and always when an open
   question is unresolved**.
6. **The gate** - the orchestrator puts it to you; **`gate_record`** records your answer.
   Skipping a review after a security surface was touched, or tests after a behaviour
   change, needs a second answer.

## Where the rules are enforced

| Rule | Enforced by | How |
|---|---|---|
| Phases run in order, each after its gate | engine | `phase_start` refuses |
| Implementation needs its authorising gate | engine | `phase_start implement` refuses |
| Decisions only you can make are asked, in every mode | engine | `phase_finish` stops on open questions |
| A fix loop stops at its budget | engine | `loop_attempt` blocks the run |
| A phase is finished by its specialists' reports | engine | `phase_finish` refuses without one |
| Nothing reaches git except as you chose | guard hook | Bash and PowerShell commands checked against the ship choice |
| No destructive or unapproved commands | guard hook | `bash_guard` and `dependency_guard` in policies |
| Reviewers cannot edit what they review | write guard | `write_guard` in policies, by calling specialist |
| Only the engine writes the ledger | write guard | ledger files refused to every Write and Edit |
| Concurrent writers never lose an update | engine | a cross-process lock around every ledger change |
| Your other sessions are untouched | hooks | enforcement applies only to sessions that own the run |
| Undo never overwrites your edits | engine | only the run's checkpointed delta is reversed, and only if it applies cleanly |

## Why hub-and-spoke

A single agent running fifteen phases carries every file it read into every later
decision, and eventually loses the thread - the run is followed in narration while phases
are silently skipped. Here each specialist's context holds one task, and the
orchestrator's context holds reports of at most 25 lines. The full output lives on disk
under `.onestop/reports/`, where the next specialist who needs it reads it.

## State on disk

| Path | What | Written by |
|---|---|---|
| `.onestop/run.json` | the run ledger - schema `registry/run.schema.json` | engine only |
| `.onestop/reports/<phase>/` | every specialist's report and write-up | engine, specialists |
| `.onestop/events.jsonl` | an audit trail of tool calls, blocks and gate answers | engine, hooks |
| `.onestop/sessions` | the sessions that own the run | hooks |
| `.onestop/checkpoints/` | the private index behind checkpoints | engine |
| `.onestop/runs/` | archived runs | engine |

`.onestop/` ignores itself in git. Nothing onestop writes for its own bookkeeping ever
appears in your diff.
