# Shared - Artifact Placement Protocol

Where each phase puts what it produces, and who writes it. The map is
`${CLAUDE_PLUGIN_ROOT}/registry/artifacts.json`; this file is how to use it.

Why it exists: before it, each phase invented its own path. The analyst wrote
`docs/ba/<feature>/RTM.md`, the implement phase looked there, and nothing else in the
pipeline agreed. A traceability matrix that one phase writes and another cannot find
stops being maintained inside a sprint, and then it lies.

---

## 1. Resolve the Path Before Writing

In order:

1. **Defer to the repository.** If it already has a home for this kind of document, use
   it. A repo with `docs/adr/` gets ADRs there. A repo with a docs site - docusaurus,
   mkdocs, vitepress, sphinx - gets documents inside that site's content root, or they
   are written and never published.
2. Otherwise use the default path from the registry.
3. **One slug per run.** Decided at intake, kebab-case, recorded in the ledger. Every phase
   resolves against the same slug, or the directories fork.
4. **Never create a second documentation root.** If `docs/` and `doc/` both exist, use the
   one with the most recently modified file, and say which you chose.

## 2. The Three Roots

| Root | Holds | Committed |
|---|---|---|
| `docs/` | durable product documentation, reviewed like code | yes |
| `.onestop/` | the run ledger, stored reports and run evidence | **never** - it ignores itself |
| repo source convention | test and automation code, which is source | yes |

**Discovery notes and review findings are run evidence, not documentation.** They
describe the repo at one moment and are stale the next day, so they live in `.onestop/`.
A compliance record is the opposite - an auditor will ask for it - so it is committed
under `docs/compliance/`.

`.onestop/` carries its own `.gitignore` containing `*`, written by the engine on first
use. The user's `.gitignore` is never edited.

## 3. The Map

| Phase | Writes | Owner |
|---|---|---|
| context | `.onestop/run.json` (the ledger); stack facts under `.onestop/reports/context/` | engine; `stack-adapter` |
| requirements | `docs/requirements/<slug>/` - `brd.md`, `user-stories.md`, `RTM.md`, `RTM.csv` | `ba-analyst` |
| research | `docs/research/<slug>/findings.md` | `researcher` |
| upgrade-plan | `docs/research/<slug>/upgrade-plan.md` | `researcher` |
| discovery | `.onestop/reports/discovery/` | `discovery-scout`, one per unit |
| design | `docs/design/<slug>/system-design.md`, `adr/ADR-<NNN>-*.md`, `contracts/` | `architect`, `contract-agent` |
| ui-design | `docs/design-system/` - `palette.md`, `tokens.css`, `components.md` | `ui-designer` |
| plan | `docs/design/<slug>/plan.md`; `.onestop/partition/<slug>.json` | `planner`; `work-partitioner` |
| scaffold | the project skeleton, `README.md`, configuration examples | `architect` (scaffold mode) |
| reproduce | the failing regression test | `test-author` |
| verify-green | characterization tests | `build-resolver`, `test-author` |
| implement | source + `RTM.md` `Impl-Ref` | `implementer` (or the intent's code role), `test-author` |
| test | tests + `RTM.md` `Test-Ref` | `test-author` |
| automation | `tests/e2e/`, the app suite, `docs/qa/<slug>/automation.md`, CI workflow | `web-automation-agent`, `app-automation-agent` |
| qa-plan | `docs/qa/<slug>/test-plan.md`, `test-cases.csv` | `qa-planner` |
| review | `.onestop/reports/review/`; `.onestop/review/<slug>.md` | the panel; `validator` |
| compliance | `docs/compliance/<slug>.md` | `security-reviewer` |
| measure | `docs/performance/<slug>.md` | `performance-agent` |
| ship | `README.md`, `CHANGELOG.md`, configuration examples | `docs-agent` |

Full detail - format, contents - in the registry.

**Ownership is enforced.** Read-only roles (the scouts, explorers and reviewers) may write
only under `.onestop/`; documentation roles (planner, analyst, QA planner, researcher,
security reviewer, validator) may also write documentation. The write guard refuses
anything else - see `write_guard` in `${CLAUDE_PLUGIN_ROOT}/registry/policies.json`.

## 4. Reports

Every specialist ends with a REPORT of at most 25 lines. The engine stores it as it
arrives, at `.onestop/reports/<phase>/<NN>-<agent>.md`. Anything longer - findings with
evidence, the stack facts - goes in the specialist's write-up,
`.onestop/reports/<phase>/<agent>[-<unit>].full.md`, the exact path its brief names. Later
specialists read those files; the orchestrator keeps only the report.

Gate decisions are not a separate artifact: the engine's `gate_record` writes each one
into the ledger.

## 5. The RTM Is a Relay

One artifact is written by one phase and completed by three others. Its columns, exactly:

`Req-ID, Type, Source, Story, Acceptance-Criteria, Design-Ref, Impl-Ref, Test-Ref, Status`

| Column | Filled by | With |
|---|---|---|
| `Req-ID` .. `Design-Ref` | requirements, design | the requirement and where it is designed |
| `Impl-Ref` | implement | `path:line` of the code satisfying the requirement |
| `Test-Ref` | test, then automation | test id or spec path - a requirement may carry both |
| `Status` | implement -> test -> validator | `specified` -> `implemented` -> `tested` -> `verified` |

`verified` is set only by the validator, in review, after it has seen the test pass.
Update a row in the same motion as the work, never in a cleanup pass, and keep `RTM.csv`
in step with `RTM.md` - if the two disagree, both are wrong.

The check that earns the matrix its keep: **which requirements have no `Test-Ref` of any
kind.** The validator asks it before ship.

## 6. Announce Every Path

Every report names the paths it wrote under `files:`. Not "documentation updated" - the
paths. An artifact the user cannot locate was not delivered.

## 7. Forbidden

1. **Never write a document into the application source tree.** `src/` is code.
2. **Never put test or automation code under `docs/`.** It is source; it belongs where the
   runner looks.
3. **Never create a parallel documentation root.** Detect first.
4. **Never commit `.onestop/`**, and never edit the ledger - the engine owns it.
5. **Never echo an artifact's body into chat.** Report the path, the counts and the
   notable decisions.
