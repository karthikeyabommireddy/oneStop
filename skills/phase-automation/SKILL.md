---
name: phase-automation
description: Build end-to-end automation for the described journey across web and native app targets. Binds the existing or default framework per target, delegates to the web and app automation agents, and wires artifacts and CI. Loaded by the orchestrate skill; not usually invoked directly.
version: 1.0.0
user-invocable: false
metadata:
  origin: onestop
  phase: automation
---

# Phase - Automation

Turn the journey into end-to-end suites that run in CI and survive a redesign.

Unit and integration coverage proved the pieces work. This phase proves the **journey**
works - the thing the user actually described.

## When This Phase Runs

- Automatically for `flow` intent, and for `feature` and `mvp` at `standard` tier and
  above.
- Forced at `large` tier regardless of intent.
- Skipped at `trivial` and `small`, and whenever the plugin `auto_automation` setting
  is off.
- Skipped, with the reason stated, when the change has no user-facing journey - a
  library, a migration, an internal refactor.

## Target Binding

Determine the targets from the repo, not from the user:

| Repo contains | Targets |
|---|---|
| A web app only | web |
| A native or cross-platform app only | app |
| Both | **both** - one suite each, not a choice between them |

A repo with a web front end and a mobile client is two targets. That is not ambiguity
and it is not a question - bind one framework from each list.

Bind the framework per target from `${CLAUDE_PLUGIN_ROOT}/registry/stacks.json.automation_frameworks`.
**A framework already present in the repo always wins over the default.** Never
introduce a second framework for the same target.

Ask only in the two genuinely equal cases named in the registry selection rules -
React Native with a device-farm requirement, and a mixed Flutter plus native repo.

## Pattern Binding

**A framework is half a decision.** Within Playwright there are several structures and
they are not equal - a suite built on an inheritance-based `BasePage` tree flakes more
and costs more to change than one built on composed fixtures, and the difference never
shows up as a failing test. Bind the structure too, from
`${CLAUDE_PLUGIN_ROOT}/registry/patterns.json` -> `automation_patterns`.

| Target | Default pattern |
|---|---|
| Playwright (any language) | fixture-composed page objects |
| Cypress | app actions with `cy.session` |
| Selenium *(only if already present)* | page objects with explicit waits |
| Detox, Espresso | robot pattern |
| XCUITest, Appium, WinAppDriver | screen objects |
| Maestro | composed YAML flows |

Selection order: **a pattern already in the repo always wins**; otherwise the registry
default; escalate only when a `scale_up_from` trigger is objectively true; ask only when
an `equally_viable_when` condition actually holds.

State both bindings on one line before writing anything:

```
Bound: Playwright, fixture-composed page objects (parallel-safe, no BasePage god-object)
```

Worked skeletons - structure, config, locator priority, the flake table:

- web: `${CLAUDE_PLUGIN_ROOT}/skills/phase-automation/references/playwright.md`
- app: `${CLAUDE_PLUGIN_ROOT}/skills/phase-automation/references/native.md`

## Delegation

| Target | Agent |
|---|---|
| web | `web-automation-agent` |
| app | `app-automation-agent` |

Run them in parallel when both targets exist - they share no state.

Pass each agent: the decomposed flow steps with their acceptance criteria, the
discovery record showing which routes, screens and identifiers actually exist, and the
bound framework.

## The Gap Rule

**Never write a spec for a step discovery could not locate in the code.**

A test pointed at a route or screen that does not exist either fails permanently or,
worse, passes vacuously. Report the gap instead:

```
gaps: step 4 (recent-orders list) - no matching route or component found;
      automation deferred until the slice lands
```

If the implementation phase built the step, discovery from before implementation is
stale - re-check against the current tree before declaring a gap.

## Coverage Expectation

Per journey, both targets:

- The happy path as narrated, end to end.
- The inferred states: loading, empty, error, unauthorised.
- The boundaries the flow crosses: auth, pagination, and on app targets also
  permissions, offline, cold start versus warm resume, and back-navigation.

A happy path alone is not coverage. It is a demo.

## CI Wiring

Automation that does not run in CI decays within weeks. Before handing off:

- The suite runs on pull requests.
- Artifacts upload on failure - screenshots, video, traces, device logs.
- Retries small in CI, zero locally, so flake surfaces instead of hiding.
- The exact reproduction command is in the handoff.

## Traceability

Append the end-to-end spec to `Test-Ref` for every requirement the journey covers - a
requirement can carry both a unit and an end-to-end reference, and knowing it has both is
useful.

## Output

```
AUTOMATION
  targets:   <web / app / both>
  web:       <framework + pattern, specs written, run command, executed result>
  app:       <framework + pattern, platforms, flows written, run command, executed result>
  wrote:     <every path - suite root, docs/qa/<slug>/automation.md, CI workflow>
  coverage:  <journey steps covered / total>
  ci:        <workflow files touched, or none>
  gaps:      <steps without automation, and why>
  flaky:     <anything quarantined, with the reason and what would release it>
```

Artifact placement: `${CLAUDE_PLUGIN_ROOT}/skills/shared/artifacts.md`. The suite is
source and lives where the runner looks - never under `docs/`.

## Rules

1. **Never automate a step that does not exist.** Report the gap.
2. **Never add a second framework** for a target that already has one.
3. **Never bind a framework without binding its pattern**, and never invent a structure
   the registry already answers. An unstructured suite works this week and is rewritten
   next quarter.
4. **Never assert inside a page object, robot or screen object.** Assertions live in the
   spec, where the failure message names the behaviour that broke.
5. **Never select on a build-generated class** - an Angular `ng-tns-c*` scope class, a
   CSS-module hash, a Tailwind JIT artefact. They pass locally and break on the next
   deploy, and the failure looks like a product bug.
6. **Never use a fixed sleep.** Framework synchronisation only.
7. **Never weaken an assertion to stop a flake.** Diagnose the cause.
8. **Never claim a suite passed if it did not execute here.** Name what is missing.
9. **Both targets when both exist.** A mobile app with only web automation is a gap,
   and it is reported as one.
