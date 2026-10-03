# qa-planner - method

Read by the `qa-planner` specialist before it acts; its brief names this file first.

## Scope Is the Change, Not the Application

Establish exactly what changed - from the implementation summary if the pipeline just ran,
otherwise from `git diff --stat` and the branch. Then plan around that surface and the
regression risk it creates.

A test plan covering the whole product on every change is ignored by the second sprint.

## What a Case Must Be

**Runnable by a stranger.** Someone who has never seen this feature must be able to
execute the plan without asking a question. That is the bar, and it is the one most test
plans fail.

- **Preconditions** - the exact state required before step 1.
- **Numbered steps** - one action each. "Log in and go to orders" is two steps.
- **Concrete data** - real values, not "enter a valid email". Give
  `qa-buyer-01@example.test`. A placeholder is where two testers diverge.
- **Observable expected result** per step - what appears on screen, what the value
  becomes, what message shows. Never "it works".
- **Priority** - critical, high, medium - so a short cycle knows what to cut.

## Test Data Creation Is Part of the Plan

The most commonly missing section, and the one that costs the most time. Give numbered,
runnable steps to create every account, record, permission and fixture the cases need -
seed commands, admin UI paths, or API calls with real payloads.

If a case needs a state that is hard to reach (an expired subscription, a failed payment,
a partially shipped order), say exactly how to produce it. "Arrange for the payment to
fail" is not an instruction.

## Coverage

- **Happy path** for every acceptance criterion in scope.
- **The states the request never mentioned** - empty, loading, failure, unauthorised,
  offline. This is where real defects live.
- **Boundaries** - the limits, and one past each.
- **Permissions** - each actor who should be allowed, and one who should not.
- **Cross-cutting** - the browsers, devices, screen sizes or locales this change actually
  risks. Not a generic matrix nobody runs.
- **Regression** - a short checklist of existing behavior this change could plausibly
  break, derived from the knowledge graph edges into the changed modules. Short and
  targeted beats long and ignored.

## Artifacts

`docs/qa/<slug>/test-plan.md` - overview, environment, test data creation, cases,
regression checklist, sign-off table. If the repository already keeps test plans elsewhere
(`docs/test/`, a wiki export), follow it - `${CLAUDE_PLUGIN_ROOT}/skills/shared/artifacts.md`.

`docs/qa/<slug>/test-cases.csv` - the same cases, flat and importable. RFC 4180,
header exactly:
`Case-ID,Title,Priority,Req-ID,Preconditions,Steps,Expected,Status`

Identical case set in both. `Req-ID` links each case back to the RTM - that link is what
lets the matrix report manual coverage alongside automated.

## Output

```
QA PLAN
  scope:      <the change surface planned against>
  cases:      <n> - <n> critical, <n> high, <n> medium
  data:       <n> setup procedures
  regression: <n> checks, derived from <what>
  files:      <md and csv paths>
  traced:     <requirement ids covered>
  gaps:       <automated coverage missing - reported back, not papered over>
```
