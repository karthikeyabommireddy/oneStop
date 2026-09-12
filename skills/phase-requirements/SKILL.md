---
name: phase-requirements
description: Turn a thin request, ticket, or spec document into testable acceptance criteria before planning begins. Runs only when the input lacks criteria a plan can be built on. Loaded by the orchestrate skill.
version: 1.0.0
user-invocable: false
metadata:
  origin: onestop
  phase: requirements
---

# Phase - Requirements

Delegate to the `ba-analyst` agent. It derives from the codebase and the domain before
asking anything, and it produces the traceability matrix the rest of the pipeline fills
in as work lands.

Run only when the input cannot support a plan: a one-line request, a ticket with a
title and no body, or a spec that describes a solution without saying what "done"
means. Skip whenever usable acceptance criteria already exist - do not re-derive what
the ticket already states.

## Deriving, Not Interrogating

Most of what a thin request omits is recoverable without asking. Derive first:

- **From the codebase** - how do comparable features in this repo behave? Their
  validation, error handling, permission model and empty states are the defaults for
  this one unless the request says otherwise.
- **From the domain** - a checkout has a payment failure path; a login has a lockout
  policy; a list has an empty state. These are not open questions, they are known
  requirements of the shape of thing being built.
- **From the ticket context** - linked issues, the epic, recent related commits.

Ask only for what genuinely cannot be derived and would change the build if wrong.
Batch it into one message, with your derived assumption stated as the default so the
user can simply approve.

## Acceptance Criteria

Each criterion is observable, testable, and specific. It becomes a test assertion
verbatim, so imprecision here propagates all the way to the automation suite.

```
Given <the starting state>
When  <the action>
Then  <the observable outcome>
```

Cover, for every requirement: the happy path, the boundaries, the failure paths, the
permission cases, and the empty and loading states. The states nobody mentions are
where defects live.

## Out of Scope

State explicitly what this work does **not** include. An unstated boundary is where
scope creep enters, and writing it down costs one line.

## Output

```
REQUIREMENTS
  objective:  <the outcome, in one line>
  criteria:   <numbered, in given/when/then form>
  assumed:    <what was derived rather than stated, and the source>
  out of scope: <explicit exclusions>
  open:       <the few things genuinely needing the user, each with a default>
```

## Rules

1. **Derive before asking.** Most gaps are answerable from the repo and the domain.
2. **Every criterion is testable.** If you cannot write an assertion from it, rewrite it.
3. **Never invent a business rule silently.** Assumptions are labelled as assumptions.
4. **State exclusions explicitly.**
5. **Skip this phase entirely** when the input already carries usable criteria.
