# onestop

**One stop, one command, whole lifecycle.**

Describe what you want in plain language. onestop classifies the intent, searches your
codebase, binds the right specialists, and drives plan, design, code, test, web and app
end-to-end automation, review and ship.

You never pick an agent. You never pick a skill. You never pick a phase.

```
/onestop "user signs in with Google, lands on the dashboard, sees their recent orders"
```

---

## The Asking Contract

This is the rule the whole plugin is built around.

**It asks you only when:**

1. **Information is genuinely missing** and guessing wrong would produce wrong work.
2. **Discovery found two or more real options** that lead to materially different work.

**It never asks when:** it has not searched yet, only one option is viable, the repo
already demonstrates a convention, a professional default exists, or it just wants
permission to continue.

When it does ask, it asks once per phase, with evidence, ranked, with a recommendation
and a default - so `go` is always a valid answer.

```
Step 1 - Google OAuth sign-in. Three viable paths found:

  A. Extend the existing next-auth setup        [recommended]
     src/auth/options.ts:14 already configures Credentials.
     Adding the Google provider is ~15 lines, one env pair, zero new deps.

  B. Add Auth.js v5 alongside
     Newer API, but next-auth v4 is pinned at package.json:31 and the
     migration touches every call site in src/app/api/auth/.

  C. Hand-rolled OAuth against googleapis
     Full control, but you own token refresh, PKCE and session rotation.
```

## How a run works

```
   your request
        |
   [ classify ]   14 intents, 4 size tiers - automatic, never asked
        |
   [ decompose ]  narrated flows split into steps, each independently verified
        |
   [ discover ]   one scout per step, in parallel - searches before asking anything
        |
   [ broker ]     7-test cascade resolves what it can; only the rest reaches you
        |
   [ bind ]       role agents + language packs, from your detected stack
        |
   [ partition ]  task DAG + write surfaces -> waves that can run concurrently
        |
   [ phases ]     plan -> design -> implement -> test -> automation -> review -> ship
        |            ^         (waves run in parallel)                    ^
     GATE 1 --------                                          GATE 2 ------
     approve the plan                                    approve the ship
```

Everything between the two gates flows without stopping.

## Role agents and knowledge packs

Most agent catalogues ship one reviewer per language - sixteen near-identical files that
drift apart as they are maintained. onestop separates **role** from **knowledge**:

- **23 role agents** define *how* to review, plan, test, refactor, or resolve a build.
- **29 packs** define *what* is true about a language or a concern.

A role agent loads the packs the detected stack names and applies them on top of its own
contract. One `code-reviewer` knows every language onestop has a pack for, and a diff
spanning TypeScript and Python loads both packs into a **single** review rather than
running two agents that each see half the change.

```
django project  ->  code-reviewer + packs[python, django] + concerns[security, data]
react + RN app  ->  code-reviewer + packs[typescript, react, react-native]
                    + concerns[accessibility]
```

Adding a language means adding one pack file, not another sixteen-file agent.
A language with no pack falls back to `packs/languages/generic.md` - an unrecognised
stack is never a blocker.

**The role agents**

| Phase | Agents |
|---|---|
| requirements | `ba-analyst` |
| discovery | `discovery-scout`, `code-explorer`, `option-broker` |
| design | `architect`, `contract-agent`, `a11y-agent` |
| ui-design | `ui-designer`, `a11y-agent` |
| plan | `planner`, `work-partitioner` |
| implement | `test-author`, `build-resolver`, `refactor-agent`, `performance-agent`, `merge-coordinator` |
| test, qa-plan | `test-author`, `qa-planner` |
| automation | `web-automation-agent`, `app-automation-agent` |
| review | `code-reviewer`, `security-reviewer`, `data-reviewer`, `validator` |
| ship | `docs-agent` |

Full map, with what each phase hands on: `skills/shared/agent-flow.md`.

## Parallel execution

Independent work runs at the same time. The binding constraint is never the dependency
graph - it is the **write surface**, because two agents editing one file corrupt it in a
way that looks plausible.

```
partition  ->  wave 1 (5 lanes, one message)  ->  join + verify
           ->  wave 2 (2 lanes, one message)  ->  join + verify  ->  ...
```

`work-partitioner` resolves each task's *true* write surface - including the registration
and barrel files a plan never mentions - and forms waves whose write sets are disjoint.
`merge-coordinator` joins each wave, runs the full suite over the combined state, and
hunts the semantic conflicts a file-level partition cannot catch: duplicate helpers two
lanes invented independently, contract drift, divergent conventions.

| Phase | Parallel? |
|---|---|
| discovery, research, review, automation | always - read-only or different targets |
| implement, test | only after the partition proves write surfaces are disjoint |
| ship, compliance | never |

**The mechanical rule:** a wave is dispatched as several Agent calls in **one message**.
Calls in separate turns are sequential however parallel the transcript looks - the most
common way an orchestrator claims concurrency it does not have.

The interface contract is the biggest unlock: once agreed, both sides build at once
instead of one waiting. `scripts/test_parallel.py` is the executable spec -
six scenarios including the barrel-file collision, migration isolation, and the honest
case where a dependency chain gains nothing:

```
  PASS  contract unlocks frontend and backend    [T1] -> [T2,T3,T4]
  PASS  hidden barrel collision serialises       [A] -> [B] -> [C]
  PASS  deferred registration recovers it        [A,B,C] -> [REG]
  PASS  migration never shares a wave            [M] -> [X,Y]
  PASS  pure chain gains nothing                 [S1] -> [S2] -> [S3]
```

## Requirements and live traceability

When a request arrives without usable acceptance criteria, `ba-analyst` derives them -
from the codebase first (how do comparable features here already behave?), then the
domain (a checkout *has* a payment-failure path), then the ticket context. It asks only
for what genuinely cannot be derived.

It produces a traceability matrix, and **the pipeline fills it in as work lands**:

| Column | Filled by |
|---|---|
| `Req-ID`, `Story`, `Acceptance-Criteria`, `Design-Ref` | requirements phase |
| `Impl-Ref` | implement phase, as each slice lands |
| `Test-Ref` | test and automation phases, as coverage arrives |
| verified against reality | `validator`, before Gate 2 |

So the matrix is a live coverage report rather than a document that goes stale in a
sprint. The number it exists to surface is the one that usually disappears: requirements
with **no test of any kind**.

`qa-planner` then drafts the manual test plan - documents only, never test code, with
concrete test data creation steps runnable by a stranger - and reports automated coverage
gaps back rather than papering over them with manual cases.

## The knowledge graph

onestop keeps a structural map of your repository so phases ask *where* something is
instead of reading the codebase to find out. Built by
[graphify](https://pypi.org/project/graphifyy/), driven through `scripts/kg.sh`.

```bash
pip install graphifyy==0.9.16     # the whole setup
```

| When | What happens | Cost |
|---|---|---|
| First run in a repo | full build + report | slow, once |
| Every turn that changed source | `graphify update` via the `Stop` hook | **~1s, no LLM** |
| A phase needs to locate something | `kg.sh explain` / `kg.sh path` | instant |

Each edit appends to `.onestop/kg-dirty`; the Stop hook does **one** refresh per turn,
not one per edit, and skips non-source files. Discovery queries the graph before it
greps, and reads only the files the graph pointed at.

The graph is **structural truth, not behavioural truth** - an edge means a call exists,
not that it runs or is correct. It cannot see dynamic dispatch or string routing, so
onestop never concludes code is unused from the graph alone.

No graphify installed? It says so once and reads files directly. Slower, still correct.
Full detail in [docs/knowledge-graph.md](docs/knowledge-graph.md).

## Design direction

When a change touches UI, a `ui-design` phase runs **before** any component is written,
because retrofitting a design system means touching every component - which is why it
usually never happens.

**Colour follows the domain.** A palette that fights its domain reads as untrustworthy
before anyone can say why: a clinical product in neon feels unsafe, a developer tool in
pastel feels like a toy. onestop detects the domain and binds one of 11 profiles:

| Domain | Hue | Density | Motion | Defining constraint |
|---|---|---|---|---|
| fintech | deep blue / forest green | compact | minimal | one accent only; tabular figures |
| healthcare | teal / soft blue | comfortable | minimal | red reserved **entirely** for clinical alerts |
| devtools | indigo / cyan | compact | fast | dark-first; syntax is a separate scale |
| ecommerce | neutral canvas | comfortable | moderate | CTA colour used for nothing else |
| enterprise | neutral blue | compact | minimal | interface recedes, data is the content |
| media | dark, one accent | comfortable | expressive | never pure black behind video |
| education | warm blue / green | comfortable | moderate | "incorrect" informs, never punishes |
| social | neutral chrome | comfortable | expressive | chrome must host any user content |
| logistics | status-led | compact | minimal | readable in greyscale and sunlight |
| creative | monochrome | spacious | expressive | typography and whitespace carry it |
| generic | neutral blue | comfortable | moderate | defensible defaults, stated as such |

Palettes are built in **OKLCH** (perceptually uniform, so ramp steps look evenly spaced -
HSL ramps always have a muddy middle), named **by role not by hue**
(`--color-danger`, never `--color-red-500`), and **contrast-verified programmatically**
before use. A palette that looks good and fails contrast is a redesign scheduled for
later.

Dark mode is designed, not inverted: elevation gets *lighter* rather than gaining a
shadow, accents lose chroma, and the base is never pure black.

An existing design system always wins - onestop extends it rather than replacing it.
Full detail in [docs/design-system.md](docs/design-system.md).

## Intents

The router scores your request against 14 intents and runs that intent phase mask.

| Intent | When | Distinctive first move |
|---|---|---|
| `feature` | capability does not exist | research prior art before designing |
| `flow` | you narrate a journey | decompose, then discover **per step** |
| `defect` | something is broken | reproduce as a failing test first |
| `change` | works, but should differ | update tests to the new spec first |
| `refactor` | structure improves, behavior stays | prove the suite is green first |
| `mvp` | bootstrap from nothing or a spec | vertical slices, never layers |
| `review` | assess a diff or PR | bind every reviewer the diff triggers |
| `test` | coverage or automation work | measure current coverage first |
| `design` | architecture only | map what exists before proposing |
| `investigate` | explain how it works | trace real paths, never assume |
| `perf` | something is slow | baseline and profile before optimizing |
| `security` | hardening or vulnerabilities | enumerate the attack surface |
| `ops` | CI, deploy, infra | reproduce locally before editing CI |
| `docs` | documentation | read the source of truth |

Size tiers - `trivial`, `small`, `standard`, `large` - decide which phases are skipped
or forced, so a one-line change does not get a full architecture document. Security
triggers and public contract changes escalate the tier automatically.

## Automatic stack binding

24 stacks are detected from marker files and lockfiles. Each binds its packs, test
runner, coverage command and automation frameworks with no input from you:

| Detected | Packs | Web automation | App automation |
|---|---|---|---|
| React / Next.js | typescript, react | Playwright | - |
| Vue / Nuxt | typescript, vue | Playwright | - |
| Django | python, django | Playwright (Python) | - |
| FastAPI | python, fastapi | Playwright (Python) | - |
| Go | go | Playwright | - |
| Rust | rust | Playwright | - |
| Java | java | Playwright (Java) | - |
| Kotlin / Android | kotlin | - | Espresso |
| Swift / iOS | swift | - | XCUITest |
| Flutter | dart | Playwright | `integration_test` |
| React Native | typescript, react, react-native | - | Detox |
| C# / .NET | csharp | Playwright (.NET) | WinAppDriver |

Plus TypeScript, Python, C/C++, PHP/Laravel, F#, PyTorch/ML, SQL, and a generic fallback.

**A framework already in your repo always wins over the default.** onestop never
installs a second Playwright next to your Cypress.

## Web and app automation

A repo with both a web front end and a mobile client gets **both** suites. That is two
targets, not a choice.

Every automated journey covers the happy path plus the states the narration skipped -
loading, empty, error, unauthorised - and on app targets also permissions, offline,
cold start versus warm resume, and back-navigation.

Two rules keep the suites trustworthy: **never automate a step discovery could not
locate in the code** (report the gap instead), and **never weaken an assertion to stop
a flake** (diagnose the cause, or quarantine with a written reason).

## Commands

| Command | Purpose |
|---|---|
| `/onestop <request>` | The entry point. A request, a narrated flow, a ticket ID, a PR URL, or a spec path. |
| `/onestop-status` | Read-only view of the current run - phases, decisions, open questions, gates. |
| `/onestop-resume` | Resume the active run from its first incomplete phase. |

`/onestop` fetches ticket and issue content through MCP when a server is available and
falls back to asking for a paste - a failed fetch never aborts a run.

## Install

```bash
claude plugin marketplace add karthikeyabommireddy/oneStop
claude plugin install onestop@onestop
```

That is the whole install. Then, in any repository:

```bash
/onestop "user signs in with Google, lands on the dashboard, sees their recent orders"
```

**Optional but recommended** - the knowledge graph, so onestop stops re-reading your
codebase:

```bash
pip install graphifyy==0.9.16
```

Without it everything still works; phases read files directly instead, which is slower.

### Verify an install

```bash
python scripts/verify_install.py   # packaging - 20 checks
python scripts/validate.py         # internal consistency
python scripts/test_routing.py     # classifier and stack binding
python scripts/test_parallel.py    # wave scheduler
```

All four run on every push via GitHub Actions.

## Configuration

| Setting | Default | Effect |
|---|---|---|
| `gate_mode` | `standard` | `strict` adds a gate before automation; `autonomous` keeps only the ship gate |
| `coverage_threshold` | `80` | Minimum line coverage before review runs |
| `auto_automation` | `true` | Generate web and app E2E suites automatically |
| `research_depth` | `standard` | `none` searches only your repo; `deep` always researches externally |
| `knowledge_graph` | `auto` | `auto` builds and refreshes the graph automatically; `manual` refreshes only on request; `off` disables it |

Optional per-repo overrides: `.onestop/stack.yml` declares components and stacks
explicitly and ends detection; `.onestop/run.json` is the run ledger, written
automatically.

Your repo always wins: `CLAUDE.md`, `AGENTS.md`, `CONTRIBUTING.md`, lint and format
config, and existing conventions outrank every default in this plugin.

## Layout

```
onestop/
  .claude-plugin/   plugin.json, marketplace.json
  commands/         onestop, onestop-status, onestop-resume
  registry/         the routing brain
    intents.json    14 intents, size tiers, security triggers
    stacks.json     24 stacks, 6 web + 7 app automation frameworks
    patterns.json   architecture + automation patterns, SOLID checks, file roles
    artifacts.json  where every phase writes what it produces
    design.json     11 domain design profiles, OKLCH system, scales
    ui-styles.json  15 visual styles, derived from domain and audience
    gates.json      gate protocol - shape, no-batching, gate zero
    parallel.json   wave scheduling, write-surface and failure rules
    agents.json     derived role-agent catalogue  (generated)
    packs.json      derived pack catalogue        (generated)
    skills.json     derived skill catalogue       (generated)
  agents/   23 role agents
  packs/
    languages/      24 language packs
    concerns/       5 concern packs
  skills/
    orchestrate/          the engine
    parallel-execution/   the wave scheduler
    phase-*/              19 phase skills, each with its own references/
    shared/               protocols every phase reads
      architecture.md     pattern binding, smart/dumb roles, SOLID, system design
      artifacts.md        artifact placement and the RTM relay
      agent-flow.md       phase-to-agent map and the delegation brief
  hooks/            PostToolUse + Stop, keeping the knowledge graph fresh
  rules/common/     operating rules and the authority order
  templates/        stack.yml, adr.md
  docs/             knowledge-graph.md, design-system.md
  scripts/
    kg.sh               knowledge graph wrapper
    build_registry.py   regenerate the derived registries
    validate.py         consistency gate - run in CI
    test_routing.py     executable spec - classifier and stack binding
    test_parallel.py    executable spec - wave scheduler
```

## License

MIT
