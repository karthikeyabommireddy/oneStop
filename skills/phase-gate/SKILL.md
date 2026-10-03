---
name: phase-gate
description: Why onestop gates every phase boundary, and the edge cases - gate zero, skips, adjustments, blocked phases, user-only decisions, gate modes. The format itself is orchestrate Step 5; the engine records and enforces every gate. Loaded by the orchestrate skill; not usually invoked directly.
version: 2.0.0
user-invocable: false
disable-model-invocation: true
metadata:
  origin: onestop
  role: gate-protocol
---

# Phase Gate

**The canonical gate format is orchestrate Step 5.** This file explains why it is shaped
that way and how the edge cases run. Rules as data: `${CLAUDE_PLUGIN_ROOT}/registry/gates.json`.

The user always knows what onestop just did, what it is about to do and who will do it,
and what onestop recommends - and can redirect before any of it happens.

## Three Parts, Three Owners

| Part | Owner |
|---|---|
| The question | the orchestrator - an `AskUserQuestion` call, never prose asking "shall I continue?" |
| The record | the engine - `gate_record`; nobody else writes `.onestop/run.json` |
| The enforcement | the engine - `phase_start` refuses a phase while an earlier one awaits its gate, and refuses implement until its authorising gate is approved |

onestop's first end-to-end run followed the pipeline in narration while skipping ten of
fifteen phases: a written instruction to confirm is trivially skipped under context
pressure and leaves no trace. A tool call is a real stop with a real answer; an engine
that refuses the next phase is what makes the stop stick.

## Gate Zero

Classification is automatic. Proceeding on it is not. Before any phase runs, say in plain
words what kind of task this is (`announce_as`), the request words that decided it, the
tier and what it changes, the full phase list with anything removed and why, which gates
will stop in this mode, which gate authorises implementation, and the stack about to be
bound.

Options: continue · **it is a different kind of task** (the plan is rebuilt and gate zero
is presented again) · adjust the phases · stop.

A request the user thought was automation work, classified as a feature, runs the wrong
pipeline end to end. Gate zero is where that costs one sentence instead of an hour.

## Compact by Default

The engine's progress line carries the whole run in one line - every phase with its
mark, the pending ones being the journey still to come. A gate adds only what changed:
what the phase produced, the decisions it left, what is next and who does it, and a
recommendation. Every phase's outcome is spelled out only at the plan gate and the ship
gate, where the user approves the whole.

```
PROGRESS   ✓intake ✓context ✓requirements ✓discovery ✓research ⏸design ·ui-design ·plan ·implement ·test ·review ·ship
JUST DID   design - modules, the redirect contract (302/410/404) -> docs/design/short-links/
NEXT       ui-design - ui-designer binds the domain palette and style
RECOMMEND  Continue. The contract is settled, so implement can build both sides at once.
```

Options: Continue to ui-design (Recommended) · Skip ui-design · Adjust first · Stop here.

## One Gate Per Phase

Never combine phases behind one gate - not analysis phases, not phases that produced
nothing, not at the trivial tier. Batching was tried: the user could no longer see what
each phase did, which is the thing per-phase gating exists to provide. **"Nothing to
decide here" is the user's judgement, not the orchestrator's.** A phase with nothing to
decide gets a short gate - one keystroke.

## Decisions Only the User Makes

A specialist that needs a human decision returns it under `open:` with a recommended
default. Those decisions - a technology, a version, a dependency, an unknown command -
are never resolved silently. The engine stops at that phase in every gate mode, even
autonomous, and returns them as `open_questions`; they go in the gate's DECIDE section.
Record each answer with `run_note` (`resolve`), and each approved dependency or tool with
`run_note` (`approval`) - the guard refuses unapproved installs.

## Options

Four at most, recommendation first. Free-text redirect is always available.

| Option | Meaning |
|---|---|
| **Continue to `<phase>`** | Proceed as recommended. |
| **Skip `<phase>`** | Move past it. **State what is lost** - a skip whose cost is unstated is a decision made blind. |
| **Adjust first** | Take the user's input, record it (`run_note` amendment), and **re-present the gate** so they confirm the amended direction. |
| **Stop here** | End the run (`gate_record` stopped) and report exactly what exists and what does not. |

## Skips

Never refuse a skip - the user owns it - with one exception: ship cannot be skipped. To
keep work out of git, the user chooses "leave uncommitted" at the ship gate.

Two skips need a second answer, and the engine decides when they apply: skipping
`review` after a security surface was touched, and skipping `test` after implement
changed behaviour. `gate_record` returns `needs_confirmation` with the specifics; show
them, ask once more, and pass `confirmed: true` only if the user still skips.

## Blocked Phases

When a retry budget runs out, the engine blocks the run. The gate shows the last real
error and every approach tried: try another approach (`adjusted` - one more round) ·
accept and move on (`approved`) · stop. Never retry past the budget without that answer.

## Between Gates

Announce, in one line each: every specialist dispatched and what it is working on, every
parallel wave with its lane count, every file written (path only), and every decision
resolved without asking with the rule that settled it. Never narrate file reads or
reasoning that produced nothing.

## Gate Modes

| Mode | Stops at |
|---|---|
| `every-phase` (default) | every phase boundary |
| `milestone` | gate zero, the authorising gate, design, implement, ship |
| `autonomous` | gate zero and ship |

In every mode: gate zero, ship, a blocked phase, and a phase that left a user-only
decision. A mode changes how often the user approves; it never changes what a gate looks
like, never silences the narration, and never lets onestop decide for the user.

## Scaling

Gate content scales with tier; the gate never disappears. Trivial: one line of what was
done and what is next, continue or stop. Large: the full shape plus every open decision.

## Rules

1. **A gate is an `AskUserQuestion` call**, never prose asking for confirmation.
2. **The engine records the answer** - `gate_record`, never an edit to the ledger.
3. **Always recommend**, with a reason.
4. **State the cost of a skip** before the user takes it.
5. **Re-present the gate after an adjustment.**
6. **User-only decisions are always asked**, whatever the gate mode.
7. **Never let a phase run that the user has not seen coming.**
