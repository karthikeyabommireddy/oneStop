# Changelog

## 1.9.1

A flow review found ten defects, all of them drift between something that was changed in
v1.5.0 and something that was not. The first is the one that mattered.

### Fixed - the per-phase gate check could never fire

Two incompatible schemas existed for `.onestop/run.json`. `orchestrate/SKILL.md` - the
file that *creates* it - documented phases as bare status strings under a top-level
`{gate_1, gate_2}` object. `phase-gate/SKILL.md` - the file that *updates* it -
documented a per-phase object carrying `status` and `gate`.

`run-conformance.sh` detects an ungated phase by finding a line that is
`"status": "done"` with no `"gate"` on it. A run written to orchestrate's schema has no
`status` key anywhere, so that pattern could never match: **the only mechanical check
that per-phase gating actually happened reported clean on runs that gated nothing.**
Enforcement that cannot fire is worse than no enforcement, because it is trusted.

Verified against a fixture rather than by inspection. The fixed schema now reports:

```
PHASES RAN WITHOUT A GATE - context
BATCHED GATES - 1 phase(s) share a combined gate stamp
RUN INCOMPLETE - phases not yet done: plan, design
```

The old shape reports none of that, and its pending-phase scan additionally emitted a
phantom phase called `phases` - it was matching the container key. Both the schema and
that scan are fixed.

### Fixed - the two-gate model survived in twenty files

`gates.json` names two-gates-at-the-ends as the *defect* v1.5.0 removed, and sets
`every-phase` as the default. The vocabulary outlived the model, including in both
user-facing diagrams and in `commands/onestop.md`, which is the contract passed to the
orchestrator - so it was actively instructing the superseded behaviour.

Gate 1 and Gate 2 are now **the plan gate** and **the ship gate**: two named gates among
many, keeping their extra force. No implementation before the plan gate; nothing
committed, pushed or published before the ship gate, which stops in every mode at every
tier. Migrated across agents, skills, rules, commands, the README diagram and the
derived registries.

### Fixed - the status command could not report what the protocol records

`onestop-status` emitted exactly two gate lines. An `every-phase` run has one gate per
phase in the mask, so it could show two of fourteen. It now reads each phase's `gate`
field and reports the mode alongside them - and names an ungated phase as a conformance
failure rather than rendering it as approved.

### Fixed - the flow diagram contradicted the registry

`skills/shared/agent-flow.md` showed `design -> ui-design -> plan`. Every real
`phase_mask` has **plan before design**, and `gates.json` `milestone` mode agrees with
the registry. The diagram also omitted `intake` and `flow-decomposition` - which begin
every mask - and showed `scaffold` as a normal step when it appears only in `mvp`. Fixed,
with the registry named as the source of truth for ordering.

### Fixed - two artifacts nothing wrote or read

`.onestop/ledger.md` and `.onestop/gates/gate-<n>.md` were both declared in
`artifacts.json` in v1.7.0 with no writer and no reader. Worse, "the ledger" already
meant `run.json` everywhere else in the plugin, so the first one added a second thing
with an existing name. Both removed; `run.json` is the run ledger and its per-phase
`gate` field is the gate record.

### Fixed - the resume example bound an ECC agent

The run-state example in `orchestrate/SKILL.md` showed `"reviewer": "react-reviewer"`.
onestop has no such agent - it is an ECC one. onestop binds role agents plus packs, so
the example now reads `code-reviewer [typescript, react, accessibility]`, alongside the
bound automation pattern.

### Added - a validator check for schema drift

The root cause of six of these was a declaration and its consumer drifting apart with
nothing checking the join - the same class as the `qa-planner` phase bug in v1.7.0. The
validator now fails if `orchestrate` documents a phase as a bare status string, if a
`gate_1`/`gate_2` object reappears, or if the conformance hook stops reading the fields
the schema provides. Tested against both regressions to confirm the check itself fires.

## 1.9.0

### Added - a coding-standards floor, separate from architecture

`skills/shared/standards.md` is the line-level layer that sat between two things onestop
already had. Three layers now, and they do not overlap: **architecture** decides how the
system is shaped, **standards** decides how a line is written, **language packs** decide
what is idiomatic. Where a pack disagrees with the floor the pack wins - it knows the
idiom. Where the repository disagrees with the pack the repository wins, because a change
that is correct but foreign is still a change the team has to live with.

It covers naming, immutability, error handling, async, types, constants, comments,
function shape, tests, queries and a smell table - each with the failure it actually
prevents rather than the rule alone. Two entries are deliberately against the grain:

- **DRY has a caveat, and it matters.** The wrong abstraction costs more than
  duplication: two functions that look alike today and diverge tomorrow become one
  function with a boolean parameter, then two. The rule is three strikes - deduplicating
  on the second occurrence is a coin flip. `code-reviewer` is now explicitly told *not*
  to raise duplication on its second occurrence.
- **`fetch` does not throw on a 404.** A missing `response.ok` check is the most common
  real instance of a swallowed error in JavaScript, and it is now a named review finding.

Wired into `phase-implement`, `phase-review`, `code-reviewer` and `test-author`, so one
floor applies everywhere rather than each phase carrying its own copy.

### Added - seven more visual styles, and an explicit default

The fifteen were not the whole field. Researched against what is actually shipping and
added:

- **Liquid Glass** - Apple's iOS 26 / macOS Tahoe material. It is a *rendering model that
  happens to look glassy*, not a glassy look, which is why the entry says to use the
  system API rather than hand-roll it: the OS version reacts to content and ambient light
  in ways CSS cannot, and a copy drifts from the system every release.
- **Swiss / International Typographic Style** - the modular grid, one sans-serif,
  asymmetry inside strict structure. Every 12-column layout descends from it. Centring
  everything is the most common misreading.
- **Spatial / depth-first** - 3D that solves comprehension, never the wow. The binding
  question: does the third dimension carry information a 2D version could not?
- **Generative / agentic UI** - a conversational layer *over* a conventional UI. The
  safety boundary is that the agent selects from pre-approved components and passes
  structured arguments; it never emits markup.
- **Aurora / mesh gradient** - blurred radial blobs over a deep ground, 8-12 second
  cycles.
- **Kinetic typography** - motion introduces meaning, then settles. If a reader must wait
  for an animation to finish, the animation has become a paywall on the content.
- **Dark-first data interface** - the Linear/Supabase/Vercel pattern for all-day tools.
  Dark mode is not inverted light mode: elevation lightens, accents lose chroma.

**An explicit default.** `default_style` is now a first-class field, and the validator
enforces that exactly one style carries `is_default` and that it is bindable for *every*
domain - a default with a `never` entry would leave some domain with no fallback at all,
the one case selection cannot recover from. Minimalism holds it, because it is the style
that costs least when it is wrong: minimal applied to a product that wanted personality
is merely plain, while maximalist applied to a product that wanted calm is harmful.
Defaulting is still stated as a decision - "minimalism (default: no strong domain signal
in this repo)" - never dressed up as though the domain demanded it.

**Anti-patterns are now recorded too**, so the reasoning is not rediscovered: Corporate
Memphis (exhausted, and criticised on substance for flattening human individuality into a
uniform language), anti-design (neo-brutalism already delivers the personality with the
affordances intact), and trend-chasing generally - a style bound with no argument from
domain, audience, session length or stakes will need replacing when the trend moves.

22 styles, 11 domains, every domain with at least one strong fit.

## 1.8.0

### Added - fifteen visual styles, derived not asked

`registry/ui-styles.json` gives the `ui-designer` a real choice about what an interface
*feels* like, where `design.json` only decided the palette. Each style was researched
against current practice and carries four things: the signature that makes it
recognisable, the CSS recipe that makes it convincing, the accessibility cost it imposes,
and - the part usually missing - the conditions under which it is the wrong answer.

minimalism · maximalism · glassmorphism · neumorphism · claymorphism · brutalism ·
neo-brutalism · skeuomorphism · flat 2.0 · Material 3 · bento · Y2K · retro · cyberpunk ·
editorial.

**The style is derived, never offered as a menu.** Selection scores the detected domain
against each style's `domain_fit`, then adjusts for audience, session length and the
stakes of a mistake - an all-day professional tool and a launch campaign want opposite
answers. `domain_fit.never` is a hard exclusion: cyberpunk is not bound for a healthcare
product because it looks good, because it would not look good - it would look
untrustworthy to someone reading a diagnosis. The user is asked only when two styles
score within a point *and* would produce materially different interfaces.

What the research actually changed:

- **Neumorphism's defining feature is its accessibility failure.** An element the same
  colour as its background has no contrast at its boundary, so the control's edge is
  invisible to low-vision users and to everyone in bright sunlight. It now ships with a
  mandatory mitigation - a real border, a high-contrast focus ring, 44px targets - and
  the note that if the mitigation destroys the look, the style was wrong for that product.
- **Glassmorphism's contrast depends on what scrolls underneath it**, which is why text
  gets a semi-opaque plate and is verified against the worst background the panel can sit
  over, not the screenshot it was designed with. Blur stays at 8-15px, 2-3 elements per
  viewport, never animated.
- **Neo-brutalism has three tells** separating a convincing implementation from a
  cargo-culted one: zero blur on every shadow, a press distance exactly equal to the
  shadow offset, and an explicit `:focus-visible` - since the heavy border is already
  taken and cannot double as focus.
- **Cyberpunk on pure black is the maximum-eye-strain combination.** Near-black `#05050a`,
  accents capped at 10-15% of the surface, one loud focal element per page.
- **Bento is a layout, not a skin** - it composes with a skin rather than replacing one,
  and its tile spans must encode priority or it is just an uneven grid. DOM order must
  match visual priority or keyboard users get the page in a meaningless sequence.
- **Flat 2.0 exists because pure flat broke affordance.** Every actionable element needs
  at least two of: contrasting fill, border, elevation.

`skills/phase-ui-design/references/styles.md` carries copy-ready CSS for all fifteen.

### Fixed - Releases was empty while nine commits had landed

GitHub builds the Releases page from tags, and nothing in this repo ever created one - so
pushing published code and left Releases blank. All seven shipped versions are now tagged
and released from their real commits, and `.github/workflows/release.yml` publishes a
release automatically whenever `VERSION` changes on main, using the hand-written
`CHANGELOG.md` section as the notes. It verifies before publishing, so a release cannot
ship code that fails its own gate.

### Fixed - four stale counts in the README

It claimed 20 stacks (24), 18 phase skills (19), 18 role agents (23) and 24 packs (29).
The agent table also listed only 7 of the 10 staffed phases, omitting requirements,
ui-design and qa-plan entirely.

### Added - a validator check for the style registry

Every `domain_fit` id must be a real domain, no style may be both `strong` and `never`
for one domain, every style must state an accessibility cost and a recipe, and every
domain must have at least one strong fit - otherwise selection falls through to the
default there forever, invisibly.

## 1.7.0

### Added - the pattern inside the framework

Binding Playwright was only half a decision. Within Playwright there are several
structures and they are not equal: an inheritance-based page-object tree flakes more and
costs more to change than composed fixtures, and that difference shows up as rewrite cost
rather than as a failing test. The same gap existed everywhere - Cypress, Detox, Espresso,
XCUITest - and for the application code itself, which had no declared architecture at all.

**`registry/patterns.json`** now answers *how*, where `stacks.json` answers *which*:

- **Automation patterns** for all 13 bindable frameworks. Playwright and its four language
  ports bind **fixture-composed page objects** - compose, never inherit; page objects
  expose `Locator`s and never assert; `getByRole` before `getByTestId` before CSS; no
  `waitForTimeout`; no conditional assertion; auth once via `storageState`. Cypress binds
  app actions with `cy.session`. Detox and Espresso bind the robot pattern. XCUITest,
  Appium and WinAppDriver bind screen objects. Maestro binds composed flows. Each entry
  names what it supersedes and why.
- **Application architecture** - `container-presentational` (smart/dumb) for frontends,
  `layered-ports` for services, `modular-monolith` for greenfield, with `feature-sliced`,
  `hexagonal` and `cqrs` reachable only when a declared trigger is objectively true.
  Escalating without a fired trigger is how codebases acquire abstractions nobody needed.
- **SOLID as diff-level checks** - each principle stated as a signal visible in a diff
  with the fix, not as a phrase to cite. "Violates SRP" is not a finding; "this file both
  parses the webhook and charges the card" is.
- **File roles** - every file written declares one role (`smart`, `dumb`, `service`,
  `adapter`, `transport`, `pure`), and the role fixes what it may import. The
  `code-reviewer` now checks import lists against roles, which catches the structural
  defects no test ever fails on.

### Added - where artifacts go

**`registry/artifacts.json`** maps all 19 producing phases to their output paths, with a
resolution rule that defers to whatever documentation home the repository already has.

This fixed a live divergence: `ba-analyst` wrote the requirements matrix to
`docs/ba/<feature>/RTM.md`, nothing else in the pipeline agreed on that path, and the
`ui-design` phase named a contrast report with no path at all. A matrix one phase writes
and another cannot find stops being maintained inside a sprint, and then it lies.
Requirements now live at `docs/requirements/<slug>/`, and the RTM's relay - `Impl-Ref` by
implement, `Test-Ref` by test and automation, `Status` through review - is written down.

### Added - techwave-style skill layout

Each phase skill can now carry its own `references/`, and `skills/shared/` holds the
protocols every phase reads: `architecture.md`, `artifacts.md`, `agent-flow.md`. New
worked references - the full Playwright fixture skeleton, the native robot and screen
patterns, smart/dumb before-and-after in React, Angular, Vue and Python, and a system
design template. Role agents stay in the plugin-root `agents/`, since those are registered
Claude Code subagents rather than inline prompt files.

### Fixed - four agents declared phases that could never bind

`qa-planner` declared `phases: test` while the phase it serves is `qa-plan`, so the manual
test planner could never be selected - a run would silently skip QA planning with nothing
reporting it. `ui-designer` did not declare `ui-design`, `performance-agent` did not
declare `measure`, `test-author` did not declare `reproduce`, and `build-resolver` and
`validator` did not declare `verify-green`.

### Added - four validator checks

1. **Agent phase coverage** - every phase in a `phase_mask` has an agent declaring it, and
   no agent declares a phase that does not exist. This is the check that catches the class
   of bug above.
2. **Automation pattern coverage** - every bindable framework has a pattern. It immediately
   found two gaps: `selenium` and `winappdriver` had none, so an agent would have invented
   a structure. Both now have entries.
3. **Artifact map coverage** - warns on any phase that writes without a declared path.
4. **Internal reference integrity** - every `${CLAUDE_PLUGIN_ROOT}` path resolves on disk.
   A broken one is silent at runtime: the model simply does not load the protocol it was
   told to follow.

## 1.6.0

### Fixed - onestop shipped no MCP servers, so a real run borrowed another plugin's

Running onestop against a live Angular app exposed that `plugin.json` declared
`mcpServers: {}`. `web-automation-agent` instructs the model to derive selectors from the
**real page** rather than guess them - which is the single thing that made that run's
output trustworthy - and onestop provided no browser tooling to do it with. The run
silently used a browser server from another installed plugin. On a machine without that
plugin, the same run would have had to guess selectors.

Now declared, all three zero-config (no API key, `npx` fetches on first use):

- **`chrome-devtools`** - live page inspection for the automation agents
- **`playwright`** - driving the browser during the automation phase
- **`context7`** - vendor documentation for `phase-research`

Ticket-ingestion servers (`github`, `atlassian`, `linear`) are **documented as opt-in
rather than declared**, in `docs/mcp-servers.md`: each needs credentials, and a declared
server that cannot authenticate produces connection noise every session. `orchestrate`
already falls back to asking for a paste when a probe fails.

`scripts/validate.py` now fails if onestop stops declaring a server its own agents depend
on.

### Added - four stacks onestop could not detect

The same run was an **Angular 21** app, and onestop had no Angular pack and no Angular
stack detection - it would have bound the generic TypeScript pack and missed every
framework-specific rule.

- **`angular`** - including the trap that run had to discover by hand: Angular emits
  build-generated `ng-tns-c*` scope classes that are regenerated on essentially every
  build, so a selector using one passes locally and breaks silently on the next deploy.
  Also `ng-dirty`/`ng-valid` state classes, which browser autofill sets - actively
  misleading in a fresh-page test. Plus signals-vs-zone.js, subscription leaks, RxJS
  flattening-operator choice, standalone-vs-NgModule.
- **`svelte`** - runes vs stores, the server/client import boundary, form-action CSRF.
- **`ruby`** - N+1, strong parameters, callback chains, migration reversibility.
- **`elixir`** - supervision, GenServer blocking, Ecto changesets, LiveView assigns.

24 language packs, 24 detectable stacks. A new check warns about any pack no stack can
reach, since unreachable knowledge is knowledge nothing will ever bind.

### Not done, deliberately

**ECC's 292 skills were not copied.** onestop deliberately replaced one-skill-per-topic
with role agents plus knowledge packs, and vendoring that catalogue would undo the
standalone, original-work decision this plugin was rebuilt around in 1.1.0. The correct
analogue of a missing ECC skill is a missing pack - which is what the four above are.

## 1.5.0

### Changed - one gate per phase, every gate shows the whole journey, and the intent is announced before anything runs

Three gaps found by running v1.4.0 on a real build (the LinkStack challenge):

**Batching is now forbidden.** On that run four analysis phases were combined behind a
single gate, on the reasoning that none of them individually had a decision for the
user. The effect was that the user could no longer see what each phase did - which is
precisely what per-phase gating exists to provide. "Nothing to decide here" is the
user's judgement, not the orchestrator's. A phase with no decision still gets its own
short gate. `run-conformance.sh` now flags any batched gate stamp.

**Every gate shows the whole run, not just the current step.** The gate shape grew from
four sections to six: PROGRESS (every phase in the mask, with its state and one-line
outcome), JUST DID, NEXT, REMAINING, RECOMMEND, OPTIONS. A user should never have to
scroll back to learn what happened in phase two, and seeing REMAINING lets them redirect
early rather than at the end.

**Gate zero - the intent is announced and consented to before phase one.** Classification
stays automatic; proceeding on it no longer is. Every intent now carries `announce_as`
text stating in plain words what kind of task it is - "This is an automation / testing
task", "This is a bug fix" - alongside the signals that decided it, the tier, the full
phase list, and the specialists about to be bound. The user can reclassify at that point
and the mask is rebuilt. A request meant as automation work, classified as a feature,
otherwise runs the wrong pipeline end to end.

### Fixed - two real classifier bugs

- **`automate the login journey` classified as `flow`**, because "journey" fired and tied
  with "automate" on score, losing on sort order. Automation verbs are now negative
  signals for `flow`: a journey you want to *automate* is a testing task.
- **`crashes` never matched the `crash` signal at all.** Matching is whole-word, which
  correctly stopped `change` firing inside `changes` but also stopped every inflection.
  Rather than reintroduce suffix matching and that bug with it, the inflected forms that
  actually occur in real requests are listed explicitly.
- The `test` intent gained 15 automation signals (playwright, cypress, appium, detox,
  regression suite, smoke test, ...) so a direct automation request lands on the right
  mask. Six routing cases added permanently; the suite is now 35.

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
