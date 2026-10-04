# Design Rationale

Why onestop's rules are the way they are. Most of them are the fix for something that
actually happened. The prompts carry the rules; this page carries the reasons, so the
prompts stay short.

## Gates are tool calls, and the engine refuses the next phase

onestop's first end-to-end run followed the pipeline in narration while skipping ten of
fifteen phases, and the user was never told. A written instruction to confirm is skipped
under context pressure and leaves no trace. So a gate is an `AskUserQuestion` call, the
answer is recorded by the engine, and `phase_start` refuses to begin a phase while an
earlier one is awaiting its gate. The model cannot skip a phase by forgetting it.

## One gate per phase, never batched

Batching was tried: four analysis phases behind one gate, on the reasoning that none had
a decision for the user. The user could no longer see what each phase did, which is what
per-phase gating exists to provide. "Nothing to decide here" is the user's judgement. The
default stays `every-phase`; the gate is compact - one progress line and what changed -
so a boundary with nothing to decide costs one keystroke.

## The engine is the only writer of the ledger

When the model wrote the run ledger by hand, three releases produced three incompatible
shapes, and the hook that checked for ungated phases read one of them - so it reported
clean on runs that gated nothing. Enforcement that cannot fire is worse than none,
because it is trusted. Now one process writes the ledger, atomically, validated against
`registry/run.schema.json`, under a cross-process lock.

## Hub and spoke

A single context running every phase carries every file it read into every later
decision. Specialists with their own contexts each hold one task; the orchestrator holds
reports of at most 25 lines. The cost of a long run grows with the number of phases, not
with the size of the repository.

## Reports are captured by a hook

If the orchestrator had to pass each report back to the engine, every report would be
written into the conversation twice. The SubagentStop hook stores it as the specialist
finishes, and sends the specialist back once if it forgot the report contract - its
findings would otherwise be lost with its context.

## Read-only means enforced

A reviewer that fixes what it reviews is no longer independent. Prose said "you are
read-only", but nothing held reviewers to it. Hooks now know which specialist made a call,
so the write guard lets read-only roles write only their own reports, and refuses shell
commands that write.

## User-only decisions stop in every mode

`autonomous` means "do not stop to approve", never "decide for me". A specialist that needs
a technology, version, dependency or command choice returns it as an open question, and
the engine stops at that phase whatever the gate mode.

## Implementation needs one authorising gate, chosen by the work

"Implementation needs an approved plan" broke every intent without a plan phase - defects,
refactors, security work, documentation - and every trivial change. The rule that holds
is narrower: one approved gate covers implementation. A plan, if the run has one; the
user's target version for an upgrade; otherwise the closest of the failing regression
test, the green baseline, or the review findings.

## Design before plan

A plan approved before the design exists is a plan for a system nobody has designed. The
plan the user approves is now the plan that gets built.

## The guard belongs to the run's own sessions

A run left open in a repository used to block `git commit` in every later session in that
repository. Enforcement now applies only to sessions that opened or resumed the run;
everything else is untouched, which is what installing a plugin should mean.

## Undo reverses only the run's own changes

The first undo diffed a checkpoint against the current working tree, so it also reversed
anything the user edited after the run's last checkpoint, and its "refuse if the files
moved on" check could never fire. Undo now reverses exactly checkpoint to latest
checkpoint, shows what it leaves alone, and refuses - changing nothing - if the user has
since edited the same lines.

## The knowledge graph is code-only

graphify's semantic mode sends repository text to whichever LLM provider it finds a key
for. On a Claude Code machine that is often an Anthropic key, billed with no notice. The
engine builds code-only - local AST extraction - and semantic mode is an explicit opt-in.

## Hooks in Node, not bash

macOS ships bash 3.2, where associative arrays fail and an empty array under `set -u`
aborts the script. Security tracking was silently off on every default Mac. One Node
dispatcher runs the same on Windows, macOS and Linux, with real JSON parsing. It is
started as `node "<plugin>/engine/hooks.mjs" <event>` - a command every shell parses the
same way, and the one form Claude Code, GitHub Copilot CLI and VS Code all run.

## One plugin, three clients

A copy of the plugin per client would drift. Claude Code, Copilot CLI and VS Code all read
the same layout, so the plugin stays one plugin and the engine absorbs the differences:
each client's tool names and arguments, how it names a specialist, how it says which
project is open. Where a client cannot support a rule - VS Code passes no final message
to SubagentStop - the run falls back to the orchestrator storing the report itself, and
the README says so.

## Commands come from the project

A hard-coded test command per language ran `vitest` in a Jest repository, `mvn` in a
Gradle one, and `pytest` outside the virtualenv. The project already knows how it is
built: in `onestop.yml`, in CI, in its task runner. Those are read first; a registry
default runs only when every tool it needs is installed; otherwise onestop asks once.

## Evidence-gated automation

Every C# repository was labelled a Windows desktop app, every Kotlin repository an Android
app, and Go and Rust services were given npm Playwright. Frameworks now bind on evidence -
a WPF project file, an Android Gradle plugin, a JavaScript front end. FlaUI replaced
WinAppDriver as the Windows default because WinAppDriver has had no release since 2020.

## Roles and packs

One reviewer per language means sixteen near-identical files that drift apart. A role
agent plus a language pack means a diff spanning two languages gets one review that sees
all of it, and adding a language is one file.

## What was deliberately not changed

- **The gate default stays `every-phase`.** The review suggested fewer gates for read-only
  intents; the project's direction is that every phase is visible and approved. The gate
  was made compact instead.
- **No per-client copies.** Gates use whichever question tool the client has
  (`AskUserQuestion`, `ask_user`, `askQuestions`), dispatch uses its agent tool, and the
  hooks run unchanged - so a second client got equivalents in the engine, not a fork.
