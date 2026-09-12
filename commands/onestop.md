---
description: Describe what you want built, fixed, changed, tested or reviewed. onestop classifies it, searches the codebase, binds the right specialists, and drives it to done - asking only when information is missing or several real options exist.
argument-hint: "[a request, a narrated flow, a ticket ID, a PR URL, or a spec path]"
allowed-tools: Read, Write, Edit, Bash, Grep, Glob, Task, WebFetch, WebSearch
---

Invoke the `orchestrate` skill with the following request.

Request: $ARGUMENTS

Follow the orchestrate skill exactly. In particular:

- Acquire Context silently before doing anything else, and reuse it if this
  conversation already has it.
- Classify the intent and size tier yourself. Do not ask the user which of these
  applies.
- If the request narrates a multi-step user journey, decompose it into steps and run
  discovery on each step independently.
- Search the repository before asking the user anything. An unsearched question is a
  banned question.
- Ask only when information is genuinely missing, or when discovery surfaced two or
  more viable options that lead to materially different work. Batch every open
  question for a phase into one interruption, present the evidence, and mark your
  recommendation.
- Bind the reviewers, build resolver, test runner, and web and app automation
  frameworks from the detected stack automatically, and state the bound set in one
  line.
- Gate every phase boundary. Two carry extra force: no implementation before the plan
  gate is approved, and nothing committed, pushed or published before the ship gate is.

If `$ARGUMENTS` is empty, read `.onestop/run.json`. If an active run exists, resume it
from the first incomplete phase. If there is no active run, ask the user what they
want to build - that is genuinely missing information.
