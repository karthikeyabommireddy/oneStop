# Shared - Agent Flow

How a run moves: one orchestrator at the hub, specialists at the spokes, an engine that
holds the state and enforces the rules. The sources of truth are data, not this page:
`${CLAUDE_PLUGIN_ROOT}/registry/intents.json` (which phases run, in what order),
`${CLAUDE_PLUGIN_ROOT}/registry/phases.json` (who leads each phase and how it is
dispatched) and `${CLAUDE_PLUGIN_ROOT}/registry/policies.json` (budgets, the report
contract, the guards). The plugin's validator checks that every agent named there exists
and that each agent's `phases:` frontmatter agrees.

---

## The Shape

```
                                 you
             approve gates · choose technologies and versions · own git
                                  │
                                  ▼
  ┌──────────────────────┐   tool calls   ┌──────────────────────────────────────┐
  │     orchestrator     │ ─────────────► │   pipeline engine (MCP server)        │
  │ plans · delegates ·  │ ◄───────────── │   ledger · gates · budgets · briefs   │
  │ explains · asks      │   recipes,     │   commands · checkpoints · scans      │
  └──────────┬───────────┘   briefs       └──────────────────▲───────────────────┘
     brief   │   ▲  REPORT (≤ 25 lines)                       │ stores reports,
             ▼   │                                            │ blocks what is not allowed
  ┌─────────────────────────────────────┐        ┌───────────┴──────────────┐
  │ specialists, each in its own context │ ─────► │ hooks: guard, write guard, │
  │ one task · one brief · one report    │  tools │ report capture, reminders  │
  └─────────────────────────────────────┘        └──────────────────────────┘
```

- **The orchestrator never does phase work.** It asks the engine what a phase needs
  (`phase_start` returns the recipe), gets each specialist's brief from the engine
  (`brief`), dispatches, reads the reports, and presents the gate.
- **A specialist starts with an empty context**, works on one task alone, writes its
  long output to disk, and ends with a short REPORT. It cannot talk to the user and
  cannot dispatch anyone; a decision it cannot make goes under `open:`.
- **The orchestrator keeps only reports.** File bodies, logs and long findings never
  enter its context. That is what keeps a fifteen-phase run inside one conversation, and
  each specialist's context down to one task.
- **The engine is the only writer of the ledger**, and the hooks enforce what prose
  cannot: the guard refuses destructive and unapproved commands, the write guard holds
  read-only roles to their reports, and SubagentStop stores every report as it arrives.

## The Run

```
intake ─► context ─► … ─► design ─► ui-design ─► plan ─► implement ─► test ─► … ─► review ─► ship
gate 0                                         authorises                                 ship gate
```

Every phase boundary is a gate in the default `every-phase` mode, and never a batched
one. `milestone` stops at gate zero, the authorising gate, design, implement and ship;
`autonomous` at gate zero and ship. In every mode the engine also stops at a blocked
phase and at any phase that left a decision only the user can make. Gate format:
orchestrate Step 5; rationale: `${CLAUDE_PLUGIN_ROOT}/skills/phase-gate/SKILL.md`.

**Implementation is authorised by exactly one approved gate:** `plan` when the run has
one, `upgrade-plan` for an upgrade, otherwise the closest of `reproduce`, `verify-green`
and `review` before implement. The engine refuses `phase_start implement` until it is
approved.

| Intent | Phases |
|---|---|
| feature | intake, context, requirements, discovery, research, design, ui-design, plan, implement, test, automation, qa-plan, review, ship |
| flow | feature, with flow-decomposition after context |
| mvp | feature, with scaffold before implement |
| change | intake, context, discovery, plan, ui-design, implement, test, qa-plan, review, ship |
| defect | intake, context, discovery, reproduce, implement, test, review, ship |
| refactor | intake, context, discovery, verify-green, implement, test, review, ship |
| upgrade | intake, context, discovery, research, upgrade-plan, verify-green, implement, test, review, ship |
| perf | intake, context, discovery, measure, plan, implement, test, review, ship |
| security | intake, context, discovery, review, implement, test, compliance, ship |
| ops | intake, context, discovery, plan, implement, test, review, ship |
| docs | intake, context, discovery, implement, review, ship |
| test | intake, context, discovery, test, automation, review, ship |
| design | intake, context, discovery, research, design, ui-design, ship |
| review | intake, context, discovery, review |
| investigate | intake, context, discovery |

The size tier then removes or lightens phases - never intake or ship.

## Phase to Specialist

| Phase | Dispatch | Lead | Also |
|---|---|---|---|
| intake | engine | - | - |
| context | single | `stack-adapter` | - |
| flow-decomposition | single | `ba-analyst` | - |
| requirements | single | `ba-analyst` | - |
| discovery | per-unit | `discovery-scout` | `code-explorer`; then `option-broker` |
| research | single | `researcher` | - |
| upgrade-plan | single | `researcher` (upgrade mode) | - |
| measure | single | `performance-agent` | - |
| reproduce | single | `test-author` | `code-explorer` |
| verify-green | single | `build-resolver` | `test-author` |
| design | single | `architect` | `contract-agent`, `a11y-agent`, `option-broker` |
| ui-design | single | `ui-designer` | `a11y-agent` |
| plan | single | `planner` | `work-partitioner` |
| scaffold | single | `architect` (scaffold mode) | - |
| implement | dev-loop | see below | - |
| test | single | `test-author` | - |
| automation | per-target | `web-automation-agent` | `app-automation-agent` |
| qa-plan | single | `qa-planner` | - |
| review | panel | `code-reviewer` | `security-reviewer`, `data-reviewer`, `a11y-agent`, `performance-agent`; then `validator` |
| compliance | single | `security-reviewer` (compliance mode) | - |
| ship | single | `docs-agent` | then `validator` |

**Reviewers are bound by evidence, never chosen.** `code-reviewer` always; the security
reviewer when a security surface was flagged or the intent is security; the data reviewer
when migrations, schema or query files changed; the accessibility reviewer when UI changed
and the stack declares the concern. The recipe states who bound and why.

| Shape | How |
|---|---|
| single | the lead, once |
| per-unit | one lead per unit (flow step, or the whole request), **all in one message**; then each `then` agent once |
| per-target | one lead per target (web, app), **in one message** |
| panel | every bound member **in one message** - they read the same diff and write nothing to the project; then each `then` agent |
| dev-loop | the per-module development loop below |

## The Development Loop

```
checkpoint "pre-implement"
work-partitioner ─► schedule_waves ─► waves of lanes with disjoint write surfaces
for each wave, every lane in ONE message per step:
    red ──► code ──► review          (build and test run inside code)
     │        │         │
     └── failure: loop_attempt ─► fix ─► rework   (at most the dev_loop budget)
merge-coordinator joins the wave ─► checkpoint "slice <n>"
budget spent ─► the engine blocks the run ─► the user decides at a gate
```

| Role | Default | By intent |
|---|---|---|
| red | `test-author` | none for docs and upgrade - the existing suite is the signal |
| code | `implementer` | refactor `refactor-agent` · perf `performance-agent` · ops `devops-agent` · docs `docs-agent` · upgrade `build-resolver` |
| build fix | `build-resolver` | - |
| review | `code-reviewer` | - |
| join | `merge-coordinator` | - |

Budgets (`policies.json`): build fixes 3 per root cause and 8 per phase, test fixes 2 per
test, review fixes 2 per finding, 3 dev-loop iterations per module, 1 lane retry. The
engine counts every attempt; it never lets a loop run past its budget without the user.

## The Brief

Built by the engine's `brief` tool and passed to the specialist unchanged. A specialist
starts with nothing else, so the brief carries everything:

1. the task and its acceptance criteria - one task, never the whole plan
2. read-first: the specialist's own method (`skills/<skill>/agents/<agent>.md`) first, then
   the phase playbook, the stack facts, the language and concern packs, the standards and
   architecture protocols for code phases, and the earlier reports it needs - nothing that
   does not apply to this dispatch
3. the resolved commands - use exactly these
4. the write surface - enforced for read-only and documentation roles
5. the artifacts this phase writes, and the budget
6. the safety invariants, verbatim from `${CLAUDE_PLUGIN_ROOT}/skills/shared/rules.md`
7. the commands the guard refuses
8. the exact write-up path and the exact REPORT block

## The Report

```
REPORT <agent> - <phase>[ - <unit>]
did:       <one or two lines>
files:     <every path written or modified, or none>
commands:  <each command run -> its result, or none>
decisions: <choices made without asking, each with the rule that settled it, or none>
open:      <decisions only the user can make, each with "recommended: <default>", or none>
blocked:   <what could not be done and exactly why, or none>
full:      <the write-up path, or none>
```

At most 25 lines; paths, never file bodies. The SubagentStop hook stores it in the ledger
the moment the specialist finishes, sends the specialist back once if the block is
missing, and adds every `open:` item to the run - which is what makes the engine stop for
them at the gate.

## Rules

1. **Never ask the user to pick a specialist.** Binding is the orchestrator's job.
2. **The orchestrator never does phase work** - it dispatches, and keeps reports.
3. **A wave is one message.** Lanes dispatched one per message run serially.
4. **Never dispatch without the engine's brief**, and never edit it on the way through.
5. **Never let a specialist return file bodies.** Paths and counts only.
6. **A specialist whose phase did not run did not run.** The ledger says so; nobody
   implies coverage that does not exist.
