# Changelog

## 1.4.0

### Changed - a gate at every phase boundary, not two at the ends

Two gates at the far ends of a fifteen-phase pipeline meant everything between them was
invisible - which is how a run once finished with ten phases silently skipped. Every
phase boundary is now a gate.

- **`registry/gates.json`** - the gate protocol: shape, option vocabulary, skip policy,
  narration rules, and the three gate modes.
- **`skills/phase-gate/SKILL.md`** - the shared protocol every boundary runs. A gate
  presents DONE (what the phase produced), NEXT (the next phase and which agents it
  spawns), RECOMMEND (what onestop advises, and why), and OPTIONS (continue / skip /
  adjust / stop, recommendation first).
- **A gate is an `AskUserQuestion` call, not prose asking for confirmation.** Written
  requests to confirm get skipped under context pressure and leave no trace; a tool call
  is a real stop with a real answer, and the ledger stamp is the record.
- **Narration between gates** - every agent spawned by name, every wave dispatched with
  its lane count, every file written by path, every decision resolved without asking and
  the rule that settled it. The bar: the user could say what onestop is doing right now
  without having to ask.
- **Adjust-and-re-present** - when the user redirects, the plan and ledger update and
  the gate is presented again, so they approve the amended direction rather than the
  original.
- **Skips are always honoured.** Two cases get one specific warning first - skipping
  review when a security trigger was touched, and skipping test on a behavior change -
  then the user's answer stands either way and the override is recorded with their name
  on it.
- **`gate_mode` default is now `every-phase`** (was `standard`); `milestone` and
  `autonomous` loosen which boundaries stop. No mode disables narration, and the ship
  gate is never skippable in any mode.
- **`run-conformance.sh` now reports phases that ran with no gate decision**, so a
  skipped gate is visible at the turn boundary rather than discovered later.

### Reconciled

The Asking Contract previously read "Phase boundaries are not questions." That governed
*decisions inside a phase* - do not ask what you could discover yourself - but it read
as a ban on telling the user anything. Both rules now stand explicitly side by side:
do not ask what you can find out, and always show what you are doing. They are not the
same instruction.

## 1.3.0

### Added - run conformance, after the first real end-to-end run exposed that nothing was enforced

onestop was dogfooded against a live project (a FastAPI wrapper over a legacy portal).
The result: **5 of 15 phases ran, 0 of 23 subagents were spawned, the change touched 3
security-trigger surfaces, and security review never happened.** No run ledger was ever
written. Every phase was followed in narration while the machinery sat unused - and
nothing detected it, because every phase, gate and "MANDATORY" in this plugin was prose
in a file that nothing read back.

Adding more prose to a 17KB skill that already was not followed would change nothing.
These changes are mechanical instead:

- **`hooks/security-watch.sh`** (PostToolUse) - scans each written source file against
  the nine security-trigger surfaces in `registry/intents.json` and records which ones
  it touched. Source files only; docs mentioning "password" are not a security surface.
  Replayed against the real `client.py` from the dogfood run, it correctly identifies
  four surfaces - one more than a careful manual audit found.
- **`hooks/run-conformance.sh`** (Stop) - reports unreviewed security surfaces and
  unstamped phases at every turn boundary, and says plainly when no run ledger exists
  at all, which is the signal that the orchestrate flow never actually executed. It
  never blocks: an advisory check that can fail a turn is worse than the problem. It
  only makes skipping visible instead of invisible.
- **Ledger-first mandate** at the very top of the orchestrate skill. The first action
  of any run is now writing `.onestop/run.json` with every phase stamped, and marking
  each one done/skipped/inline with a reason as the run proceeds. A run with no ledger
  is a run that did not happen.
- **Delegation stated as the default, not an optimisation** - doing a phase inline is
  always easier and looks identical in the transcript, which is exactly why it needs to
  be a rule with an explicit `inline: <reason>` stamp rather than a preference.
- `scripts/validate.py` now verifies all four hooks stay registered; install checks
  went from 20 to 22.

## 1.2.1

### Fixed

- **`kg.sh build` no longer requires an LLM API key.** Bare `graphify <path>` extracts
  every file type it finds, including docs - and the moment a corpus has any markdown
  file alongside code (true of nearly every real repo, starting with `README.md`) it
  demands an LLM key for semantic extraction and hard-fails without one. This defeated
  the entire promise of the knowledge graph feature: a structural code graph that needs
  no LLM. `kg.sh build` now defaults to `--code-only` (local AST extraction, zero LLM
  calls) whenever no key is configured, and only uses full extraction when one is
  present. Found by running the plugin end-to-end against a real mixed code+docs
  project during dogfooding - confirmed fixed against that same project (126 nodes,
  253 edges, 0 token cost). Guarded against regression in `scripts/validate.py`.

## 1.2.0

### Added

- **Parallel execution.** onestop now decomposes work into a task DAG and runs
  independent lanes concurrently. `work-partitioner` resolves each task's true write
  surface - including the registration and barrel files a plan never mentions - and forms
  waves whose write sets are disjoint. `merge-coordinator` joins each wave, verifies the
  combination with the full suite, and hunts semantic conflicts a file-level partition
  cannot catch. `registry/parallel.json` carries the scheduling, isolation, failure and
  speculative-execution rules; `skills/parallel-execution/SKILL.md` is the engine.
- **Wave dispatch discipline.** Every wave goes out as several Agent calls in one
  message. Discovery, review, research and automation now state this explicitly - calls
  in separate turns are sequential however parallel the transcript looks.
- **Worktree isolation** for lanes that genuinely need the same files, merged one at a
  time with the suite run between each.
- **Failure containment.** A failed lane no longer stalls the wave: independent lanes
  finish, only dependents are blocked, and the next wave schedules around the failure.
- **`ba-analyst` agent and a real requirements phase.** Derives requirements from the
  codebase and the domain before asking, and produces epics, stories with Given/When/Then
  criteria including error paths, measurable NFRs, and a bidirectional orphan-checked
  traceability matrix in both Markdown and RFC 4180 CSV.
- **Live traceability.** The RTM is filled in by the pipeline as work lands - `Impl-Ref`
  by the implement phase, `Test-Ref` by test and automation - and `validator` verifies the
  references resolve to real code and real tests before Gate 2. It surfaces the number
  that usually disappears: requirements with no test of any kind.
- **`qa-planner` agent and a `qa-plan` phase.** Manual test plans as a document plus an
  importable CSV, with concrete test data creation steps runnable by a stranger. Documents
  only; automated coverage gaps are reported back rather than covered manually.
- **`scripts/test_parallel.py`** - executable specification of the wave scheduler, with
  six scenarios covering contract-unlocked concurrency, the hidden barrel collision,
  deferred registration, migration isolation, width capping, and the honest case where a
  dependency chain gains nothing.

## 1.1.0

### Added

- **Knowledge graph.** onestop now keeps a structural map of the repository via graphify
  and queries it instead of re-reading the codebase. Built once, refreshed by a `Stop`
  hook in about a second after any turn that changed source, with no LLM call. Discovery
  queries the graph before grepping. `scripts/kg.sh` wraps build, refresh, explain, path
  and report. Degrades to reading files when graphify is absent, and never blocks a run.
- **Automatic graph refresh hooks.** A `PostToolUse` hook records changed source paths;
  a `Stop` hook performs one refresh per turn rather than one per edit, and filters out
  non-source files.
- **`context` phase**, now first in every intent mask, which acquires the graph and the
  repository shape before classification.
- **Design direction.** A `ui-design` phase, a `ui-designer` agent, a `visual-design`
  concern pack, and `registry/design.json` carrying 11 domain profiles, an OKLCH colour
  system with a contrast gate, and spacing, type, radius, elevation and motion scales.
  Colour is derived from the detected product domain; contrast is verified
  programmatically rather than estimated; dark mode is designed rather than inverted; an
  existing design system is always extended, never replaced.
- **Operating rules** at `rules/common/onestop.md`, including the authority order that
  puts the repository above every plugin default.
- **Templates** for `.onestop/stack.yml` and ADRs.
- **Documentation** for the knowledge graph and the design system.

## 1.0.0

First release.

### Added

- **Single entry point.** `/onestop <request>` accepts a request, a narrated user flow,
  a ticket key, a GitHub issue or PR URL, a Confluence page, or a spec path.
  `/onestop-status` and `/onestop-resume` support long-running work.
- **Automatic intent classification.** 14 intents with signal scoring and 4 size tiers.
  The user never selects an intent, a phase, an agent, or a skill.
- **The Asking Contract.** The orchestrator interrupts only for genuinely missing
  information or a real multi-option choice - always after searching, always batched per
  phase, always with evidence, a ranking, and a default.
- **Per-step flow discovery.** A narrated journey is decomposed into steps, and each step
  gets its own parallel `discovery-scout` pass before anything is planned.
- **Option-resolution cascade.** The `option-broker` agent applies seven tests before a
  choice is allowed to reach the user, with escalation overrides for irreversible,
  cost-bearing, or preference-contradicting decisions.
- **Role agents plus knowledge packs.** 18 role agents define how to review, plan, test,
  refactor and resolve builds; 20 language packs and 4 concern packs define what is true
  about a stack. One reviewer covers every language, and a multi-language diff loads
  several packs into a single review instead of running several agents.
- **Derived routing registry.** `registry/agents.json`, `packs.json` and `skills.json`
  are generated from what is on disk, so routing cannot drift from reality.
- **20 stack bindings** covering packs, standing concerns, test runner, coverage command,
  and web and app automation frameworks.
- **Web and app automation.** 6 web and 7 app frameworks. A repo with both a web and a
  native client gets both suites. An existing framework always wins over the default.
- **15 phase skills** - requirements, discovery, research, measure, reproduce,
  verify-green, plan, design, scaffold, implement, test, automation, review, compliance,
  ship.
- **Two gates** - plan approval before implementation, ship approval before anything
  leaves the machine. CRITICAL and HIGH findings block the ship gate.
- **Run ledger** at `.onestop/run.json` so a run survives context loss or a new session.
- **CI-ready verification.** `scripts/validate.py` proves phase coverage, agent and pack
  reference integrity, manifest agreement and registry freshness.
  `scripts/test_routing.py` is an executable specification of the classifier and the
  stack binding rules.
