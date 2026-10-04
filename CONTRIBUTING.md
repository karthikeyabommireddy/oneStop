# Contributing

## Before you open a pull request

```bash
python scripts/build_registry.py          # regenerate the derived catalogues
python scripts/verify_install.py          # packaging
python scripts/validate.py                # registries, agents, phases, hooks, policies
node --test "engine/test/*.test.mjs"      # the engine
```

All four must pass; CI runs the last three on Ubuntu, macOS and Windows. You need Node.js
18 or newer (22 in CI), Python 3.10 or newer, and git.

A change to hooks, briefs or the engine's project detection should also be tried in a
second client: `copilot --plugin-dir <onestop> --add-dir <onestop>` from a scratch
repository runs your working copy in GitHub Copilot CLI.

## How the pieces fit

Data lives in `registry/`, behaviour in `engine/`, instructions in `agents/` and `skills/`.
Prefer changing data over changing prose, and prose over changing code. Anything a model
might forget under pressure belongs in the engine or a hook, not in a prompt.
[docs/architecture.md](docs/architecture.md) has the map.

## Add a language

1. `packs/languages/<id>.md` - idioms, the review checklist, the build and test tooling.
   Copy the shape of an existing pack.
2. A stack in `registry/stacks.json`: `markers` (files that prove it), `extensions`,
   `packs`, `commands_default` with `requires` (a default runs only when every package it
   requires is in the manifest), and `web_automation` / `app_automation` - `null` unless the
   evidence binds one, with `*_when` signals for conditional bindings.
3. A detection case in `engine/test/stack.test.mjs`.

A marker that several stacks share splits its weight between them; a weak marker counts
only alongside source files of that language; a framework stack binds only when one of its
`dependency_markers` is in the manifest.

## Add a specialist

1. Two files. `agents/<name>.md` stays lite - `name`, a one-line `description` (it is in
   context in every session), `phases`, `tools`, `model: inherit`, a short identity, the
   "start with your brief" line and the rules. The method - procedure, examples, output -
   goes in `skills/<owning-skill>/agents/<name>.md`; the engine finds it by name and lists
   it first in every brief. Never give a specialist the `Agent` or `Task` tool - specialists
   are spokes. List `PowerShell` beside `Bash` (on Windows it is Copilot CLI's only shell),
   and name an MCP server both ways: `mcp__plugin_onestop_<server>` for Claude Code,
   `<server>/*` for Copilot CLI. Each client ignores the other's names.
2. Lead or join a phase in `registry/phases.json` (`lead`, `also`, `then`, `panel` or
   `roles`).
3. If it must not edit project files, add it to `write_guard.report_only` (reports only) or
   `write_guard.docs_only` (documentation and reports) in `registry/policies.json`. The
   write guard enforces it.
4. End its instructions with the report contract from the brief - the SubagentStop hook
   sends a specialist back if the REPORT block is missing.

## Add a phase

1. `skills/phase-<id>/SKILL.md` - the playbook the lead reads.
2. An entry in `registry/phases.json`: `playbook`, `lead`, `dispatch`, `read_only`, and
   `authorises_implement` if its gate can authorise implementation.
3. Its artifacts in `registry/artifacts.json`.
4. Add it to the `phase_mask` of every intent that should run it.

## Add an intent

An entry in `registry/intents.json` with `signals` (strong, weak, negative), a
`phase_mask`, an `announce_as` line for gate zero and an `example` request. Add routing
cases to `engine/test/routing.test.mjs` - every existing case must still route the same
way.

## Rules for the code

- Zero runtime dependencies. The engine and hooks use only Node's standard library.
- One plugin serves Claude Code, GitHub Copilot CLI and VS Code. Every hook stays
  `node "${CLAUDE_PLUGIN_ROOT}/engine/hooks.mjs" <event>` - Copilot CLI ignores exec-form
  `args`. Read tool calls through `engine/lib/toolcall.mjs` and callers through
  `engine/lib/owners.mjs`, never payload fields directly.
- Hooks never fail a turn: every hook exits 0, denials included - a denial is the JSON
  decision. Copilot CLI denies the tool whenever a PreToolUse hook exits non-zero.
- Markdown read with a tool is never expanded: cite plugin files as `${CLAUDE_PLUGIN_ROOT}/...`
  (every brief says what it stands for), and have the engine hand the orchestrator any
  absolute path it needs.
- Only the engine writes `.onestop/run.json`, always under the ledger lock.
- Regular expressions in `registry/policies.json` are JSON strings - write them through a
  JSON-aware tool, never through a shell heredoc, which can eat a backslash.
- Every rule that is enforced gets a test that proves it fires.

## Releases

Bump `VERSION`, `.claude-plugin/plugin.json` and `.claude-plugin/marketplace.json`
together, and add a `## <version>` section to `CHANGELOG.md`. When `VERSION` changes on
`main`, the release workflow runs every check, tags `v<version>`, and publishes the GitHub
Release with that changelog section as its notes.
