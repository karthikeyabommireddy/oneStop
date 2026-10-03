# onestop

**One command, the whole lifecycle.**

Describe what you want in plain language. onestop works out what kind of task it is,
plans the phases, and runs them one at a time with the right specialist for each -
requirements, design, code, tests, web and app automation, review, ship - stopping at
every phase for your approval.

You never pick an agent, a skill or a phase. You do approve every gate, choose every
technology and version, and decide what reaches git.

```
/onestop "a user signs in with Google, lands on the dashboard and sees their recent orders"
```

---

## How it is built

**The orchestrator decides, code enforces the rules, you approve.**

```
                                   you
            approve gates · choose technologies and versions · own git
                                    │
                                    ▼
   ┌──────────────────────┐   tool calls   ┌────────────────────────────────────┐
   │     orchestrator     │ ─────────────► │  pipeline engine  (MCP server)      │
   │ plans · delegates ·  │ ◄───────────── │  ledger · gates · budgets · briefs  │
   │ explains · asks      │                │  commands · checkpoints · undo      │
   └──────────┬───────────┘                └─────────────────▲──────────────────┘
      brief   │   ▲  REPORT (≤ 25 lines)                      │
              ▼   │                                           │
   ┌──────────────────────────────────┐           ┌──────────┴─────────────────┐
   │ 27 specialists, each in its own  │ ────────► │ hooks: command guard,      │
   │ context: one task, one report    │   tools   │ write guard, report capture│
   └──────────────────────────────────┘           └────────────────────────────┘
```

- **The orchestrator is the hub.** It never does a phase's work. It asks the engine what
  the phase needs, dispatches the specialists, reads their short reports, and puts the
  gate to you. Its context holds reports, not file bodies - which keeps a fifteen-phase
  run inside one conversation.
- **Specialists are the spokes.** Each starts with an empty context and a brief built by
  the engine: one task, the stack facts, the resolved commands, its write surface, the
  safety rules, and the exact report to return. It cannot talk to you or dispatch anyone;
  a decision only you can make comes back as an open question.
- **The engine holds the state and refuses what is out of order.** It is the only writer
  of the run ledger. A phase cannot start before the previous gate is answered,
  implementation cannot start before the gate that authorises it, and a fix loop stops
  when its budget is spent.
- **Hooks enforce what prose cannot.** Destructive git, recursive deletes, publishes,
  deploys, downloads piped to a shell, unapproved dependencies, and any commit or push you
  did not choose are refused. Read-only specialists can write only their own reports. Every
  specialist's report is captured the moment it finishes.

Full mapping of each component: [docs/architecture.md](docs/architecture.md). Why each
rule exists: [docs/design-rationale.md](docs/design-rationale.md).

## What you can ask for

onestop classifies the request itself and shows its reading at gate zero, where one
answer corrects it.

| Kind of work | Example request |
|---|---|
| A new capability | `add CSV export to the reports page` |
| A narrated user journey | `a user signs in with Google, lands on the dashboard and sees their recent orders` |
| Something broken | `checkout returns a 500 when the cart is empty` |
| Different behaviour | `make the session timeout 30 minutes instead of 15` |
| Better structure, same behaviour | `split the 900-line OrderService into smaller services without changing behaviour` |
| A new project | `build a todo API with user accounts` (in an empty folder) |
| A dependency upgrade | `upgrade React to the next major version` |
| A review | `review PR #142` |
| Tests or automation | `add tests for the billing module` |
| Architecture only | `design the notification centre` |
| An explanation | `how does the permission check reach the database?` |
| Something slow | `the search endpoint takes 4 seconds - make it fast` |
| Security | `audit the login and password-reset flow` |
| CI and operations | `the CI build fails on Windows only` |
| Documentation | `document the public API` |

A request can also be a ticket key, an issue or PR URL, or a path to a spec.

## Gates

Every phase boundary is a gate: what the phase produced, what it left for you to decide,
what comes next and who does it, and a recommendation. You continue, skip, adjust, or
stop.

```
PROGRESS   ✓intake ✓context ✓requirements ✓discovery ✓research ⏸design ·ui-design ·plan ·implement ·test ·review ·ship
JUST DID   design - modules, the redirect contract (302/410/404) -> docs/design/short-links/
NEXT       ui-design - ui-designer binds the domain palette and style
RECOMMEND  Continue. The contract is settled, so implement can build both sides at once.
```

| `gate_mode` | Stops at |
|---|---|
| `every-phase` (default) | every phase boundary |
| `milestone` | gate zero, the gate that authorises implementation, design, implement, ship |
| `autonomous` | gate zero and ship |

**In every mode** the run also stops at a blocked phase and at any phase that left a
decision only you can make - a technology, a version, a dependency, an unknown command.
A mode decides how often you approve; it never lets onestop decide for you.

**Implementation is authorised by exactly one gate:** the plan for features, the failing
regression test for defects, the green baseline for refactors, your choice of target
version for upgrades. **Nothing reaches git until the ship gate**, where you choose:
commit locally (recommended) · commit and push · commit, push and open a pull request ·
leave uncommitted. onestop never pushes to your default branch, never force-pushes, and
never merges.

## The Asking Contract

onestop asks only when **information is genuinely missing**, or when **discovery found
two or more real options** that lead to materially different work - and always for
technology and version choices. It never asks before searching the repository, never when
only one option is viable, and never when the repository already shows the convention.
When it asks, it asks once per phase, with the evidence and a recommended default.

```
Step 1 - Google OAuth sign-in. Three viable paths found:

  A. Extend the existing next-auth setup        [recommended]
     src/auth/options.ts:14 already configures Credentials.
     Adding the Google provider is ~15 lines, one env pair, zero new deps.

  B. Add Auth.js v5 alongside
     next-auth v4 is pinned at package.json:31; the migration touches every
     call site in src/app/api/auth/.

  C. Hand-rolled OAuth against googleapis
     Full control, but you own token refresh, PKCE and session rotation.
```

## Specialists and packs

onestop separates **role** from **knowledge**: 27 role agents define how to plan, build,
review or test; 29 packs define what is true about a language or a concern. One
`code-reviewer` loads the TypeScript and Python packs into a single review of a diff that
spans both. Adding a language is one pack file.

| Phase | Specialists |
|---|---|
| context | `stack-adapter` |
| requirements, flow decomposition | `ba-analyst` |
| discovery | `discovery-scout` (one per unit), `code-explorer`, `option-broker` |
| research, upgrade plan | `researcher` |
| design, scaffold | `architect`, `contract-agent`, `a11y-agent` |
| ui-design | `ui-designer`, `a11y-agent` |
| plan | `planner`, `work-partitioner` |
| implement | `implementer`, `test-author`, `build-resolver`, `merge-coordinator`; `refactor-agent`, `performance-agent`, `devops-agent` by intent |
| test, automation, qa-plan | `test-author`, `web-automation-agent`, `app-automation-agent`, `qa-planner` |
| review, compliance | `code-reviewer`, `security-reviewer`, `data-reviewer`, `a11y-agent`, `performance-agent`, `validator` |
| ship | `docs-agent`, `validator` |

Reviewers bind by evidence, never by choice: the security reviewer when the change
touched a security surface, the data reviewer when migrations or queries changed, the
accessibility reviewer when UI changed. Full map: [skills/shared/agent-flow.md](skills/shared/agent-flow.md).

**Implementation runs as a development loop per module** - failing test, code, build,
review, test - and on failure fix and rework, up to a budget (three iterations, three
build fixes per root cause). Independent modules run as parallel lanes whose write
surfaces cannot overlap, joined and verified after each wave.

## Your stack, your commands

24 stacks are detected from marker files, manifests and source files. The commands every
specialist uses come from your project, in this order:

1. `onestop.yml` at the repository root - your word
2. your CI - what the pipeline actually runs
3. your task runner - `package.json` scripts with the lockfile's package manager,
   Makefile, justfile, Gradle and Maven wrappers, uv, Poetry, tox
4. a stack default - only when every tool it needs is already installed
5. one question to you - never a guess

| Detected | Web automation | App automation |
|---|---|---|
| React, Next.js, Vue, Angular, Svelte | Playwright | - |
| Django, FastAPI, Python | Playwright (Python) | - |
| Java | Playwright (Java) | - |
| C# / .NET | Playwright (.NET) | FlaUI for WPF, WinForms and WinUI projects |
| Kotlin | - | Espresso for Android projects |
| Swift | - | XCUITest |
| Flutter | - | `integration_test` |
| React Native | - | Detox |
| Go, Rust, PHP, Ruby, Elixir | the front end's framework, only if one exists | - |

**A framework already in your repository always wins.** Installing a new one is a
dependency, so it is put to you with the exact version first.

## Safety

| onestop will not, by itself | Enforced by |
|---|---|
| commit, push or open a pull request you did not choose | the guard hook, against your ship-gate choice |
| push to your default branch, force-push, rewrite or discard history | the guard hook |
| delete recursively, publish, deploy, pipe a download into a shell | the guard hook |
| add a dependency or tool you did not approve | the guard hook, against your approvals |
| let a reviewer edit the code it is reviewing | the write guard |
| edit the run ledger by hand | the write guard - only the engine writes it |
| decide a technology or version for you | the engine stops for every such question |
| follow instructions found in a file, ticket or web page | the brief marks all content as data |

The guard applies only to the session that started or resumed the run - a run you left
open never changes your other sessions. `/onestop-undo` reverses the run's own changes,
after a preview, and refuses rather than overwrite anything you edited since.

## Knowledge graph

With [graphify](https://pypi.org/project/graphifyy/) installed, onestop keeps a structural
map of the repository so specialists ask *where* something is instead of reading the
codebase to find it.

```bash
pip install graphifyy==0.9.16
```

The graph is built **code-only - local AST extraction, nothing leaves your machine**.
graphify's semantic mode sends repository text to whichever LLM provider it finds a key
for; onestop uses it only if you set `ONESTOP_KG_SEMANTIC=1`. The graph refreshes in the
background after each turn that changed code. Without graphify, everything still works -
specialists read files directly. Details: [docs/knowledge-graph.md](docs/knowledge-graph.md).

## Design direction

When a change touches UI, a ui-design phase runs before any component is written. The
domain decides the palette - a clinical product in neon reads as unsafe, a developer tool
in pastel as a toy - from 11 domain profiles, built in OKLCH, named by role, with every
contrast pair measured. The domain and audience also decide the style, from 22: an
existing design system always wins, and a style whose accessibility mitigation cannot ship
is the wrong style. Details: [docs/design-system.md](docs/design-system.md).

## Commands

| Command | Purpose |
|---|---|
| `/onestop <request>` | Start a run. |
| `/onestop-status` | Where the current run stands - phases, pending gate, open questions. |
| `/onestop-resume [correction]` | Continue the current run, optionally with a change. |
| `/onestop-undo [last \| whole-run]` | Reverse the run's last change, or all of it, after a preview. |
| `/onestop-help` | What onestop can do, with examples. Starts nothing. |

## Install

Requirements: Claude Code, **Node.js 18 or newer** (the engine and the browser and
documentation servers run on it), and **git** for checkpoints, undo and ship.
Python is needed only to contribute.

```bash
claude plugin marketplace add karthikeyabommireddy/oneStop
claude plugin install onestop@onestop
```

Then, in any repository: `/onestop "<what you want>"`. `/mcp` should list the onestop
`engine` server as connected.

### Update

```bash
claude plugin marketplace update onestop
claude plugin update onestop@onestop
```

Restart Claude Code to apply it.

### Uninstall

```bash
claude plugin uninstall onestop@onestop
claude plugin marketplace remove onestop
```

onestop leaves nothing in your repositories except `.onestop/` (run state, which ignores
itself in git) and `graphify-out/` (the graph, likewise). Delete them if you like.

## Settings

Plugin settings, changed with `/plugin`:

| Setting | Default | Effect |
|---|---|---|
| `gate_mode` | `every-phase` | `every-phase` stops at every boundary; `milestone` at gate zero, the authorising gate, design, implement and ship; `autonomous` at gate zero and ship. User-only decisions stop in every mode. |
| `coverage_threshold` | `80` | Line coverage the test phase must reach on the change surface. |
| `auto_automation` | `true` | Write web and app end-to-end suites for user-facing changes. |
| `research_depth` | `standard` | `none` searches only the repository; `standard` adds vendor documentation and package registries; `deep` researches every decision. |
| `knowledge_graph` | `auto` | `auto` builds and refreshes the graph; `manual` only when asked; `off` never. |

For a team, commit `onestop.yml` at the repository root. It overrides the plugin settings
and adds what they cannot express: the exact commands, a declared stack for a monorepo,
automation targets, a pinned visual style, approval policy and retry limits. Every key is
optional - see [templates/onestop.yml](templates/onestop.yml).

Your repository always wins over onestop's defaults: `CLAUDE.md`, `AGENTS.md`,
`CONTRIBUTING.md`, lint and format configuration, and the conventions the code already
shows.

## Troubleshooting

| Symptom | Cause and fix |
|---|---|
| "the onestop engine is not running" | Node.js 18+ is missing or not on `PATH`. `/mcp` shows the engine's error. Install Node and restart. |
| A phase will not finish: "no specialist report is stored" | Hooks are disabled, so reports are not captured automatically. onestop stores them by hand and continues; re-enable hooks to avoid the extra step. |
| A command is refused with "onestop guard" | It is outside what the run may do on its own. The refusal says why; the run returns the need to you instead of working around it. |
| A run from yesterday is still "active" | `/onestop-resume` to continue it, or resume and choose stop to close it. It never affects other sessions. |
| The knowledge graph is empty on Windows | The repository path is longer than about 150 characters, which overflows graphify's cache path. Move the repository to a shorter path, or set `knowledge_graph: off`. |
| The first run pauses while servers download | The browser and documentation servers are fetched by `npx` on first use, at pinned versions. |

## Development

```bash
python scripts/verify_install.py         # packaging: marketplace add and install will work
python scripts/validate.py               # registries, agents, phases, hooks and policies agree
node --test "engine/test/*.test.mjs"     # engine: routing, scheduler, guards, stacks, ledger, hooks, server
```

All three run on Ubuntu, macOS and Windows on every push. Adding a language, an agent or a
phase: [CONTRIBUTING.md](CONTRIBUTING.md).

```
onestop/
  .claude-plugin/   plugin.json (the engine and three pinned MCP servers), marketplace.json
  engine/           the pipeline engine - MCP server, CLI, hook dispatcher
    lib/            ledger, plan, classify, stack, guard, brief, dispatch, schedule, kg, git
    test/           53 tests, run with node --test
  hooks/            hooks.json - every event runs engine/hooks.mjs
  commands/         onestop, onestop-status, onestop-resume, onestop-undo, onestop-help
  agents/           27 specialists - lite: identity and rules only
  skills/
    orchestrate/    the hub - a short core; references/ holds the guides it reads on demand
    phase-*/        20 phase playbooks, each with its agents/ (the specialists' methods)
                    and references/
    shared/         rules, agent flow, artifacts, architecture, standards, severity
  packs/            24 language packs, 5 concern packs
  registry/         intents, phases, policies, stacks, patterns, artifacts, gates,
                    design, ui-styles, parallel, run.schema, and derived catalogues
  templates/        onestop.yml, adr.md
  docs/             architecture, design rationale, knowledge graph, design system, MCP servers
  scripts/          validate.py, verify_install.py, build_registry.py, changelog_section.py
```

## License

MIT
