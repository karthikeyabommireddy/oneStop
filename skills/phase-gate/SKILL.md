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

## What a gate presents

Four sections, short. A gate that takes a minute to read becomes a gate that gets
rubber-stamped, which defeats the point.

```
DONE      <what this phase actually produced - files, findings, decisions>
NEXT      <the next phase, what it will do, which agents it spawns>
RECOMMEND <what onestop advises, and why, in one line>
OPTIONS   <continue / skip / adjust / stop - recommendation first>
```

**DONE** is concrete artifacts, never a restatement of the phase's purpose. "Discovery
complete" says nothing. "Found 3 existing auth implementations; `next-auth` at
`src/auth/options.ts:14` is dominant - already installed, already used by 4 routes" is
a report.

**NEXT** names the agents. The user should know who is about to work, on what, before
it happens.

**RECOMMEND** always recommends. A gate that lists options without advising pushes the
decision back onto the user without helping - that is the thing this is meant to
prevent, not introduce. If onestop cannot form a recommendation, say what is missing
and recommend the step that would resolve it.

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
