---
name: phase-gate
description: The per-phase gate protocol. Run at every phase boundary - report what the phase produced, state what comes next and who will do it, recommend a direction, and let the user approve, skip, adjust or stop. Shared by every phase. Loaded by the orchestrate skill; not usually invoked directly.
version: 1.0.0
user-invocable: false
metadata:
  origin: onestop
  role: gate-protocol
---

# Phase Gate

Every phase boundary stops and asks. The user always knows what onestop just did, what
it is about to do, who it will use, and what onestop recommends - and can redirect
before any of it happens.

Rules live in `${CLAUDE_PLUGIN_ROOT}/registry/gates.json`; this is how they are run.

## The mechanism is a tool call, not a sentence

**A gate is an `AskUserQuestion` call.** Not a line of prose asking "shall I continue?"
and not a statement of intent followed by carrying on.

This matters more than it looks. onestop's first end-to-end run followed the pipeline
in narration while skipping ten of fifteen phases, because a written instruction to
confirm is trivially skipped under context pressure and leaves no trace. A tool call is
a real stop with a real answer. The ledger stamp is the record. The Stop hook checks
both.

## Gate zero — before any phase runs

Classification is automatic. **Proceeding on it is not.** The moment the intent and tier
are decided, present gate zero and state, in plain words:

- **What kind of task this is** — "this is an automation task", "this is a bug fix" —
  not just an intent id.
- **Why it classified that way**, citing the words in the request that decided it.
- **The tier**, and what it changes.
- **The full ordered phase list** this intent produces, marking any phase that will be
  skipped and why.
- **The stack and specialists** about to be bound.

Options: continue · **it is a different kind of task** (the user names the real intent,
the phase mask is rebuilt, and gate zero is presented again) · adjust the phase list ·
stop.

A request the user thought was automation work, classified as a feature, runs the wrong
pipeline from end to end and the user finds out far too late. Gate zero is where that
costs one sentence instead of an hour.

## What a gate presents

Six sections. The user sees the **whole journey at every gate**, not just the current
step — where the run is, everything done so far, what is next, and what is still to come.

```
PROGRESS   every phase in the mask, with its state and one-line outcome
JUST DID   what the phase that just finished actually produced
NEXT       the next phase, what it does, which agents it spawns
REMAINING  the phases after that, so the user can redirect early
RECOMMEND  what onestop advises, and why
OPTIONS    continue / skip / adjust / stop
```

Worked example:

```
PROGRESS  6/15
  [x] intake        mvp intent, large tier
  [x] context       greenfield - graph deferred
  [x] requirements  10 FR, 5 NFR, 9 AC -> docs/requirements.md
  [x] discovery     empty repo, no conventions to inherit
  [x] research      nanoid adopted; ua-parser-js rejected (AGPL)
  [x] plan          7 tasks -> 4 waves
  [>] design        <- you are here
  [ ] ui-design  [ ] scaffold  [ ] implement  [ ] test
  [ ] automation [ ] qa-plan   [ ] review     [ ] ship

JUST DID   plan - 7 vertical slices, partitioned into 4 waves.
           T1 owns src/db.js so T2/T3/T4/T6 run as one 4-lane wave.

NEXT       design - onestop:architect fixes the schema, the redirect
           contract (302/410/404) and the recordClick signature.

REMAINING  ui-design -> scaffold -> implement -> test -> automation
           -> qa-plan -> review -> ship   (8 phases after this one)

RECOMMEND  Continue. The contract has to be settled before implement,
           or T3 and T4 cannot run in parallel.

OPTIONS    Continue to design | Skip design | Adjust first | Stop here
```

**PROGRESS shows every phase**, not a window around the current one. A user who has to
scroll back to find out what happened in phase two has lost the thread, which is the
thing this is meant to prevent.

## One gate per phase — always

**Never combine two or more phases behind a single gate.** Not analysis phases, not
phases that produced nothing, not skipped phases, not at trivial tier.

This was tried and rejected. On a real run four analysis phases were batched behind one
gate, reasoning that none of them individually had a decision for the user. The effect
was that the user could no longer see what each phase did — which is exactly what
per-phase gating exists to provide. **"Nothing to decide here" is the user's judgement
to make, not the orchestrator's.**

A phase with no decision still gets its own gate. It is a short one: PROGRESS, one line
of JUST DID, NEXT, RECOMMEND continue. That costs the user one keystroke and buys them
a run they can actually follow.

Stamps like `batched-analysis` or `grouped` are a conformance failure and the Stop hook
reports them.

## Options

Four at most. Recommendation first. Free-text redirect is always available through the
question tool and never needs listing.

| Option | Meaning |
|---|---|
| **Continue to `<phase>`** | Proceed as recommended. |
| **Skip `<phase>`** | Move past it. **State what is lost** - a skip whose cost is unstated is a decision made blind. |
| **Adjust first** | Take the user's input, update the plan and the ledger, then **re-present the gate** so they confirm the amended direction, not the original. |
| **Stop here** | End the run. Stamp the ledger `stopped` and report exactly what exists and what does not. |

## Skips

**Never refuse a skip.** The user owns the decision.

Two cases get one warning with specifics, then the user's answer is final either way:

- **Skipping `review` when a security trigger was touched** - name the surfaces, say
  that `${CLAUDE_PLUGIN_ROOT}/registry/intents.json` marks review mandatory for them, ask once more. If they
  still skip, honour it and record the override with their decision in the ledger.
- **Skipping `test` on a behavior change** - say plainly that it will ship with nothing
  proving it works, ask once more, then honour the answer.

Warn once, with specifics. Then do what they decide, and write down that they decided
it.

## Between gates

The user still sees the work. Announce as it happens:

- every agent spawned, by name, and what it is working on
- every parallel wave dispatched, with its lane count
- every file written or modified - path only, never contents
- every decision resolved without asking, and the rule that settled it

Do **not** narrate individual file reads, internal reasoning that produces no artifact,
or anything the last gate already said. The bar is: the user could describe what
onestop is doing right now without asking.

## Recording

Before the next phase starts, stamp the completed phase in `.onestop/run.json`:

```json
"phases": {
  "discovery": { "status": "done", "gate": "approved" },
  "research":  { "status": "skipped", "gate": "skipped-by-user",
                 "note": "user: repo patterns are enough" },
  "design":    { "status": "pending" }
}
```

A phase that ran with **no** recorded gate decision is a conformance failure, and the
Stop hook reports it.

## Gate modes

From the `gate_mode` setting: `every-phase` (default - gate at every boundary),
`milestone` (plan, design, implement, ship only), `autonomous` (ship only). Mode
changes *which boundaries stop*; it never changes what a gate looks like when it runs,
and it never disables the narration between gates.

## Scaling

Gate content scales with tier - the gate never disappears. A `trivial` change gets a
two-line DONE/NEXT and continue/stop. A `large` change gets the full shape plus the
open decisions the phase surfaced.

## Rules

1. **A gate is an `AskUserQuestion` call**, never prose asking for confirmation.
2. **Always recommend**, with a reason.
3. **State the cost of a skip** before the user takes it.
4. **Re-present the gate after an adjustment.**
5. **Never refuse a skip** - warn once on the two sensitive cases, then honour it and
   record who decided.
6. **Stamp the ledger before the next phase starts.**
7. **Never let a phase run that the user has not seen coming.**
