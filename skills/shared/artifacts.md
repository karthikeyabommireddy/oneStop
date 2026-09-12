# Shared - Artifact placement protocol

Where each phase puts what it produces. The map is
`${CLAUDE_PLUGIN_ROOT}/registry/artifacts.json`; this file is how to use it.

Why it exists: before it, each phase invented its own path. The analyst wrote
`docs/ba/<feature>/RTM.md`, the implement phase looked there, and nothing else in the
pipeline agreed - the UI phase produced a contrast report with no declared path at all.
A traceability matrix that one phase writes and another cannot find stops being
maintained inside a sprint, and then it lies.

---

## 1. Resolve the path before writing

In order:

1. **Defer to the repository.** If it already has a home for this kind of document, use
   it. A repo with `docs/adr/` gets ADRs there. A repo with a docs site - docusaurus,
   mkdocs, vitepress, sphinx - gets documents inside that site's content root, or they
   are written and never published.
2. Otherwise use the default path from the registry.
3. **One slug per run.** Decided at intake, kebab-case, recorded in `.onestop/run.json`.
   Every phase resolves against the same slug, or the directories fork.
4. **Never create a second documentation root.** If `docs/` and `doc/` both exist, use the
   one with the most recently modified file, and say which you chose.

## 2. The three roots

| Root | Holds | Committed |
|---|---|---|
| `docs/` | durable product documentation, reviewed like code | yes |
| `.onestop/` | run state and run evidence - the orchestrator's working memory | **no** - gitignored |
| repo source convention | test and automation code, which is source | yes |

The distinction that matters: **discovery notes and review findings are run evidence, not
documentation.** They describe the repo at one moment and are stale the next day. They go
in `.onestop/`. A compliance record is the opposite - an auditor will ask for it - so it
is committed under `docs/compliance/`.

Ensure the `.onestop/` gitignore entry exists **before** the first write to it, not after.

## 3. The map, in brief

| Phase | Writes |
|---|---|
| context | `.onestop/run.json` (the run ledger), `.onestop/stack.yml` |
| requirements | `docs/requirements/<slug>/` - `brd.md`, `user-stories.md`, `RTM.md`, `RTM.csv` |
| research | `docs/research/<slug>/findings.md` |
| discovery | `.onestop/discovery/<slug>.md` |
| design | `docs/design/<slug>/system-design.md`, `adr/ADR-<NNN>-*.md`, `contracts/` |
| ui-design | `docs/design-system/` - `palette.md`, `tokens.css`, `components.md` |
| plan | `docs/design/<slug>/plan.md`, `.onestop/partition/<slug>.json` |
| implement | source + `RTM.md` `Impl-Ref` filled |
| test | tests + `RTM.md` `Test-Ref` filled |
| automation | `tests/e2e/`, app suite, `docs/qa/<slug>/automation.md`, CI workflow |
| qa-plan | `docs/qa/<slug>/test-plan.md`, `test-cases.csv` |
| review | `.onestop/review/<slug>.md` |
| compliance | `docs/compliance/<slug>.md` |
| measure | `docs/performance/<slug>.md` |
| ship | `README.md`, `CHANGELOG.md`, `.env.example` |

Full detail - format, contents, owner - in the registry.

Gate decisions are not a separate artifact: each phase's `gate` field in
`.onestop/run.json` records what the user chose at that boundary, which is also
what the Stop hook reads to detect a phase that ran ungated.

## 4. The RTM is a relay

One artifact is written by one phase and completed by three others, so it gets its own
rule:

| Column | Filled by | With |
|---|---|---|
| `Impl-Ref` | implement | `path:line` of the code satisfying the requirement |
| `Test-Ref` | test, then automation | test id or spec path - a requirement may carry both |
| `Status` | implement, test, review | `specified` -> `implemented` -> `tested` -> `verified` |

A requirement whose slice landed but whose row still reads `specified` makes the matrix
lie. Update the row in the same motion as the work, never in a cleanup pass, and keep
`RTM.csv` in step with `RTM.md` - if the two disagree, both are wrong.

The check that earns the matrix its keep: **which requirements have no `Test-Ref` of any
kind.** That question is why it exists, and the validator asks it before ship.

## 5. Announce every path

Every phase output block names the paths it wrote. Not "documentation updated" -
the paths.

```
requirements
  wrote: docs/requirements/meter-ops/brd.md
         docs/requirements/meter-ops/user-stories.md  (12 stories)
         docs/requirements/meter-ops/RTM.md + RTM.csv (15 requirements)
```

An artifact the user cannot locate was not delivered.

## 6. Forbidden

1. **Never write a document into the application source tree.** `src/` is code. A design
   document there is invisible to everyone reading documentation and noise to everyone
   reading code.
2. **Never put test or automation code under `docs/`.** It is source, it must run, and it
   belongs where the runner looks.
3. **Never create a parallel documentation root.** Detect first.
4. **Never commit `.onestop/`.**
5. **Never echo an artifact's body into chat.** Report the path, the counts and the
   notable decisions. Pass extracts between agents, never whole documents.
