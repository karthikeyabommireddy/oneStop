---
description: Describe what you want built, fixed, changed, upgraded, tested or reviewed. onestop classifies it, dispatches the right specialists one phase at a time, and stops at each gate for your approval - asking only when information is missing or a real choice exists.
argument-hint: "[a request, a narrated flow, a ticket ID, a PR URL, or a spec path]"
allowed-tools: Read, Grep, Glob, Bash, Agent, Task, Skill, AskUserQuestion, WebFetch, WebSearch, mcp__plugin_onestop_engine
---

Invoke the `orchestrate` skill with this request, and follow it exactly.

Request: $ARGUMENTS

You are the hub. The engine (`mcp__plugin_onestop_engine__*`) holds the run's state and
refuses anything out of order; specialists do the phase work in their own contexts and
hand back short reports. You plan, dispatch, explain and ask - you never do a phase's
work yourself.

If the request is empty: call the engine's `run_status`. With an active run, offer to
resume it at its current phase. With none, ask what the user wants to build - that is
genuinely missing information.
