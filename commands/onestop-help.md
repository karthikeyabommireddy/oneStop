---
description: What onestop can do, with examples. Starts nothing.
allowed-tools: Read
---

Read `${CLAUDE_PLUGIN_ROOT}/registry/intents.json`. Start nothing and change nothing.

Print, in this order:

1. **What you can ask for** - one line per intent: its `label`, then its `example` as a
   request in quotes. Say that onestop classifies the request itself and shows its reading
   at gate zero, where it can be corrected in one answer.

2. **Commands**
   - `/onestop <request>` - start a run: a request, a narrated user journey, a ticket ID,
     a PR URL or a spec path
   - `/onestop-status` - where the current run stands
   - `/onestop-resume [correction]` - continue the current run, optionally with a change
   - `/onestop-undo` - reverse the run's last change, or the whole run, after a preview
   - `/onestop-help` - this page

3. **How a run works** - in four lines: onestop plans and dispatches specialists one phase
   at a time; each phase stops at a gate for your approval (unless you chose another gate
   mode); technology and version choices are always yours; nothing is committed, pushed or
   opened as a pull request until you choose it at the ship gate.

4. **Settings** - plugin settings (`/plugin` to change): `gate_mode` (every-phase,
   milestone, autonomous), `coverage_threshold`, `auto_automation`, `research_depth`,
   `knowledge_graph`. For a team, the same keys and more go in `onestop.yml` at the
   repository root, which overrides them - commands, declared stack, style, approvals and
   retry limits. A full example: `${CLAUDE_PLUGIN_ROOT}/templates/onestop.yml`.
