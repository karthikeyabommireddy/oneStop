# web-automation-agent - method

Read by the `web-automation-agent` specialist before it acts; its brief names this file first.

## Framework Binding

1. **Detect first.** Scan for `playwright.config.*`, `cypress.config.*`, `cypress/`,
   `wdio.conf.js`, or a Selenium dependency. **An existing framework always wins.**
   Never introduce a second one - that is the most common way E2E suites rot.
2. **No framework present** - bind the stack default from `${CLAUDE_PLUGIN_ROOT}/registry/stacks.json`
   (`automation_frameworks.web`). Playwright is the default for most stacks.
3. **Bind the pattern too** from `${CLAUDE_PLUGIN_ROOT}/registry/patterns.json`
   (`automation_patterns.web`). The framework is half the decision - within Playwright,
   a `BasePage` inheritance tree and composed fixtures are not equally good, and the
   difference surfaces as flake and rewrite cost rather than as a failing test. Defaults:
   Playwright -> **fixture-composed page objects**; Cypress -> **app actions with
   `cy.session`**; Selenium (only if already present) -> **page objects with explicit
   waits**. A pattern already in the repo always wins over the default.
4. **State both bindings in one line.** If the repo has no framework and two are
   genuinely equal for the target, do not choose: return `open:` with both options, the
   evidence and your recommendation, and write no specs.

## Live page

Before writing a selector, open the running app with the browser tools
(`mcp__plugin_onestop_playwright__*` or `mcp__plugin_onestop_chrome-devtools__*`) and take
an accessibility snapshot. Derive every locator from that snapshot. If no app is running,
say so and mark every selector UNVERIFIED in your report - a guessed selector is the
failure this step exists to prevent.

   ```
   Bound: Playwright, fixture-composed page objects (parallel-safe, no BasePage god-object)
   ```

Worked skeleton - directory layout, the fixture file, a page object, a spec, the config,
`storageState` auth, locator priority and the flake table:
`${CLAUDE_PLUGIN_ROOT}/skills/phase-automation/references/playwright.md`.

**Compose, never inherit.** A `BasePage` accumulates every helper any page ever needed
and becomes a god-object every spec transitively depends on. **Page objects expose
`Locator`s and never assert** - assertions belong in the spec, where the failure message
names the behaviour that broke.

## Input

The decomposed flow steps with their acceptance criteria, plus the discovery record
showing which routes, components and selectors actually exist. **Never write a spec
for a step discovery could not locate** - report the gap instead. A test against a
route that does not exist is worse than no test.

## Writing Specs

**One spec file per flow**, not per assertion. The file reads as the journey.

**Selector strategy, in strict priority order.** This is what decides whether the
suite survives a redesign:

1. Role and accessible name - `getByRole("button", { name: "Sign in" })`
2. Label, placeholder, or visible text the user actually sees
3. An explicit test id (`data-testid`), added to the source when nothing above works
4. **Never** CSS class chains, nth-child, XPath, or any selector coupled to styling

If a step needs a test id that does not exist, add it to the component. That is a
legitimate source edit and is preferable to a brittle selector.

**Waiting.** Use the framework web-first assertions and auto-waiting. Never a fixed
sleep. Never a bare timeout as a synchronisation mechanism. If something needs
waiting for, assert on the observable state that proves it arrived.

**Assertions.** Assert what the user perceives - visible text, URL, enabled state,
count of rendered rows. Do not assert on internal state, implementation details, or
the shape of a network payload unless the payload IS the contract under test.

## Coverage Per Flow

For every flow, cover all four. A happy path alone is not coverage:

- **Happy path** - the journey as narrated, end to end.
- **The inferred states** the narration skipped: loading, empty, and error. These are
  where real users live and where regressions hide.
- **Auth boundary** - if any step is protected, prove the unauthenticated case
  redirects or blocks.
- **Data boundary** - the empty result, the single result, and the paginated result
  where the flow renders a collection.

## Test Data and Isolation

- Each spec sets up its own state and tears it down. Specs must pass in any order and
  in parallel.
- Prefer API-level or seed-script setup over driving the UI to reach a precondition.
  Logging in through the UI in every spec is slow and makes an auth change break the
  entire suite. Use a stored authentication state instead.
- Never depend on a shared mutable fixture, a specific account that must pre-exist,
  or data left behind by another spec.
- Secrets and credentials come from environment variables, never from the spec file.
  Provide a `.env.example` entry for every variable you introduce.

## Artifacts and CI

- Enable screenshots on failure, video and trace on first retry.
- Set retries to a small number in CI and **zero locally** - a spec that only passes
  on retry is flaky and must be surfaced, not hidden.
- Write or update the CI job so the suite runs on pull requests, with artifacts
  uploaded on failure. Without artifacts, a red CI run is undebuggable.
- Report the run command in the handoff so a human can reproduce it exactly.

## Flake Discipline

A flaky spec is worse than a missing one - it trains the team to ignore red. When a
spec fails intermittently:

1. Diagnose the actual cause: a race, a fixed sleep, shared state, or a genuine
   product bug.
2. Fix the cause if it is in the spec.
3. If it is a product bug, report it as a finding. Never weaken the assertion to make
   it pass.
4. Only if the cause is genuinely external and unfixable now, quarantine the spec in
   a clearly named group, with a comment stating why and what would un-quarantine it.
   Quarantine is a debt record, not a wastebasket.

## Handoff

```
WEB AUTOMATION
  framework: <bound framework, and whether detected or newly added>
  specs:     <files written, one line each, with the flow each covers>
  coverage:  <flow steps covered / total, and any step skipped with the reason>
  run:       <the exact command>
  ci:        <the workflow file touched, or none>
  artifacts: <what is captured on failure>
  gaps:      <steps with no spec, and why - missing route, missing selector>
```
