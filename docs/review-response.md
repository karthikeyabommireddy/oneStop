# Review Response - onestop 2.0.0

The review of onestop 1.9.1 (73 findings, verdict "not ready for a public marketplace")
was addressed in 2.0.0, together with a change of architecture: the orchestrator is now a
hub that dispatches specialists and keeps only their reports, a pipeline engine holds the
state and refuses what is out of order, and hooks enforce the rules prose cannot. See
[architecture.md](architecture.md).

**Summary:** 67 fixed, 4 partly addressed, 2 deferred by decision. Every fix that is
enforced in code has a test in `engine/test/` (58 tests) or a check in
`scripts/validate.py`; four behavioural cases live in `evals/`.

## Correction

During the work on 1.9.1 I stated that the security-review conformance check worked. It
did not: it read the pre-1.9.1 flat ledger schema, so it never recognised a finished
review (F-07). That statement was wrong. The check no longer exists - the engine now owns
the ledger and enforces phase order itself.

## Findings

| ID | Sev. | Finding | Status | Resolution |
|---|---|---|---|---|
| F-01 | High | architect is read-only but owns design docs and scaffold | Fixed | Write, Edit and Bash, with explicit design and scaffold modes and the write scope of each. |
| F-02 | Med | Read-only agents named as owners of written artifacts | Fixed | Every artifact's owner can write it; read-only roles write only their reports, held there by the write guard; the engine stores every report. |
| F-03 | Med | phase-compliance reference files missing | Fixed | GDPR, HIPAA, PCI DSS and SOC 2 control tables; `${CLAUDE_PLUGIN_ROOT}` paths; checked by the validator. |
| F-04 | High | Automation agents can't reach the declared MCP servers | Fixed | The agents list the plugin's browser servers and derive selectors from a live page snapshot. |
| F-05 | Med | rules/common/onestop.md is never loaded | Fixed | Moved to `skills/shared/rules.md`; the engine embeds its safety invariants verbatim in every brief. |
| F-06 | Med | RTM schema, status flow and QA plan paths disagree | Fixed | One column list; `tested` by the test phase, `verified` only by the validator; one QA path; a validator check compares them. |
| F-07 | High | Conformance check reads the old ledger schema | Fixed | Superseded: the bash check is gone, the engine is the only writer of the ledger and refuses out-of-order phases. See Correction above. |
| F-08 | Med | stack.yml is both detection output and override; gitignored | Fixed | Committed `onestop.yml` at the repository root, read by the engine; detection runs every run and is recorded in the ledger. |
| F-09 | Low | Stale "fifteen styles"; seven CSS recipes missing | Fixed | Counts corrected; recipes for the seven styles; a validator check that every style has one. |
| F-10 | Low | skills.json phase field always empty | Fixed | The registry builder reads `metadata.phase`. |
| F-11 | Low | Stray files in the zip | Fixed | Files removed; `.gitattributes` export rules; releases are built by the release workflow from git. |
| F-12 | Low | Ledger enum and doc drift; no schema file | Fixed | `registry/run.schema.json`; the engine validates every read and write; docs point at the engine. |
| F-13 | High | No dependency-upgrade intent | Fixed | An `upgrade` intent and `phase-upgrade-plan`; versions from the registry on the day; the user's choice of target version authorises implementation. |
| F-14 | High | Hard-coded test/coverage commands | Fixed | The engine resolves commands from `onestop.yml`, CI, the task runner, then a default whose tools are installed - run through the lockfile's runner or the virtualenv. |
| F-15 | High | No build/lint/format commands; never asks | Fixed | Build, lint, format and typecheck defaults with requirements; unknown build and test commands are asked once at the context gate. |
| F-16 | Med | Weak markers scored as strong | Fixed | Weak markers, shared-marker weighting, and frameworks that bind only on a dependency; covered by tests. |
| F-17 | Med | Wrong platform defaults | Fixed | Evidence-gated bindings: Espresso for Android projects, FlaUI for WPF/WinForms/WinUI (WinAppDriver's last release was 2020), no npm Playwright at non-JS roots. |
| F-18 | Med | Unasked, unpinned installs; curl piped to bash | Fixed | Installs need the user's approval with a verified version, enforced by the guard; Maestro is a manual install; device-specific run lines replaced. |
| F-19 | High | Greenfield not detected; stack chosen silently; no git init | Fixed | Empty folder means `mvp`; gate zero asks language, framework and git init; versions at the research gate; scaffolds use official generators at those versions. |
| F-20 | High | Hooks and kg.sh break on macOS bash 3.2 | Fixed | One Node dispatcher in exec form; no bash anywhere in the hooks. |
| F-21 | Med | Hook extension lists miss stacks and config files | Fixed | The security-surface scan uses every stack's extensions plus configuration files, on new content only. |
| F-22 | Med | "Generic" layer carries JS/web conventions | Partly | Reviewer baseline, scaffold layout, configuration and CI made ecosystem-neutral; library/CLI and platform MVVM patterns added. `standards.md` keeps TypeScript examples, marked as illustrative with the bound pack's idiom winning; moving them into packs is open. |
| F-23 | Crit | Implement blocked for most intents | Fixed | One authorising gate chosen by the mask (plan, upgrade plan, reproduce, verify-green or review), enforced by the engine; the trivial tier keeps a light plan gate. |
| F-24 | High | New request swallowed by an active run | Fixed | `run_open` never overwrites; the user chooses resume, archive or stop. |
| F-25 | Med | Plan approved before design | Fixed | Design runs before plan in feature, flow and mvp. |
| F-26 | High | Review misses staged/untracked files and PR diffs | Fixed | The diff surface covers the working tree with staged and untracked files, a branch against its merge base, or a pull request. |
| F-27 | Med | Review-only run edits code | Fixed | A review run edits nothing, and reviewers are held read-only by the write guard. |
| F-28 | Med | No retry limits | Fixed | Budgets in `policies.json`, counted by the engine; when one is spent the run blocks for the user. |
| F-29 | Med | No checkpoints, undo or ledger validation | Fixed | Checkpoints through a private git index after every writing phase; `/onestop-undo` previews and reverses only the run's own changes; ledger validated. |
| F-30 | Med | Five intents never reach ship | Fixed | Every intent that changes files reaches ship. |
| F-31 | Med | Read-only intents pay the full gate cost | Deferred | Every-phase gating stays the default by the owner's decision. The cost was reduced instead (F-53). |
| F-32 | Med | Auto-invocation too broad | Fixed | The orchestrate skill is not user-invocable and is narrowly described; `/onestop` is the single entry point. |
| F-33 | High | userConfig settings never read | Fixed | Settings reach the engine and hooks; `onestop.yml` overrides them; both are reported as the effective settings. |
| F-34 | Med | kg.sh invocation and plugin path | Fixed | Superseded by the engine's graph module and direct `graphify` queries. |
| F-35 | High | graphify sends repository text to LLM providers | Fixed | Code-only by default; semantic extraction only with `ONESTOP_KG_SEMANTIC=1`; checked by the validator. |
| F-36 | Med | Synchronous first build; silent .gitignore edit | Fixed | First build in the background; large repositories asked first; `graphify-out/` ignores itself. |
| F-37 | High | Hooks act in every session and repo | Fixed | Hooks act only during a run, and only in the sessions that opened or resumed it. |
| F-38 | Med | Stop-hook output may be invisible | Fixed | `systemMessage` for the user and `additionalContext` for the model, with a loop guard. |
| F-39 | Low | Surface scan reads the whole payload | Fixed | New content only, tighter patterns, test files skipped. |
| F-40 | Low | 120 s blocking refresh at turn end | Fixed | Background refresh, once per turn, under a lock. |
| F-41 | Med | Subagents told to ask the user | Fixed | Specialists return decisions under `open:`; the engine stops for them. |
| F-42 | Med | No implementer agent | Fixed | `implementer`. |
| F-43 | Med | a11y-agent can write during parallel review | Fixed | Read-only, enforced by the write guard. |
| F-44 | High | docs-agent runs every README command | Fixed | Only safe, read-only commands are verified; the guard backs it. |
| F-45 | Low | Hard-coded model aliases | Fixed | `model: inherit` on every agent; checked by the validator. |
| F-46 | High | Technology and version choices made silently | Fixed | Never resolved silently; the engine stops for them in every gate mode. |
| F-47 | Med | merge-coordinator merges autonomously | Fixed | Applies lane patches; never `git merge`; the guard refuses merges. |
| F-48 | Med | One approval covers commit, push and PR; GitHub only | Fixed | Four ship choices; GitHub, GitLab and Azure DevOps CLIs; never the default branch, never force. |
| F-49 | Med | No deterministic scanners | Fixed | Installed scanners (gitleaks, package audits) run before the reviewers; never installed by onestop. |
| F-50 | Low | Test phase deletes "dead" code | Fixed | The test phase never deletes code. |
| F-51 | Low | 400-line cap contradicts "repo wins" | Fixed | Applies to new files, flagged not failed; a repository lint rule overrides; generated files exempt. |
| F-52 | Low | context7 tool names and query rules missing | Fixed | Tool names, a fallback, and no code in external queries. |
| F-53 | Med | Gate volume and token cost | Fixed | One-line progress, only what changed; full detail at the plan and ship gates. |
| F-54 | Low | allowed-tools out of date | Fixed | Each command lists what it uses. |
| F-55 | Low | No help or undo command | Fixed | `/onestop-help`, `/onestop-undo`. |
| F-56 | High | Bash-capable agents have no destructive-command guard | Fixed | The PreToolUse guard checks every shell call during a run, specialists included; read-only roles cannot write through the shell. |
| F-57 | High | MCP servers unpinned and always on | Partly | Pinned to exact versions and isolated. They stay declared so the automation and research phases can use them; making them opt-in is an open decision. |
| F-58 | Med | Docs tell users to paste tokens into .mcp.json | Fixed | OAuth or an environment variable; endpoints verified against the vendors' current documentation. |
| F-59 | High | No behavioural regression evals | Partly | 58 engine tests in CI on three platforms, and four `claude plugin eval` cases. The evals run on demand; running them on a schedule needs model credentials in CI. |
| F-60 | Med | Classifier and scheduler unused at runtime | Fixed | Both run inside the engine; their specifications are engine tests. |
| F-61 | Med | CI Linux-only; validator gaps | Fixed | Ubuntu, macOS and Windows; the validator checks hooks, ledger ownership, agent tools, recipes, policy patterns, the RTM schema and style recipes. |
| F-62 | Low | Bare-path rule too narrow | Fixed | Covers packs, templates, references and engine modules, path by path. |
| F-63 | Low | Workflow actions unpinned | Fixed | Pinned to commit SHAs; read-only permissions. |
| F-64 | Med | README settings wrong; no update/uninstall/troubleshooting | Fixed | README rewritten; CONTRIBUTING added. |
| F-65 | Low | Design domain keywords too broad | Fixed | Broad keywords removed; a domain needs two distinct signals. |
| F-66 | High | Repo files outrank safety rules; untrusted content unmarked | Fixed | Safety invariants outrank repository content and travel in every brief; fetched content is marked untrusted and quoted, never followed. |
| F-67 | Med | No package existence / typosquat check | Fixed | The researcher confirms existence, name proximity, age and repository, with licence and advisories. |
| F-68 | Med | No audit log of agent actions | Fixed | `.onestop/events.jsonl`: tool calls, refusals, gates and reports, from the engine and hooks. |
| F-69 | Med | No committed per-project config | Fixed | `onestop.yml`; documented in `templates/onestop.yml`. |
| F-70 | Med | Always-on context and oversized prompts | Partly | The orchestrator is a thin hub that keeps reports, not files; rationale moved to `docs/`. Agent files are still 3-9 KB each. |
| F-71 | Low | No multi-platform build step | Done in 2.1.0 | No build step needed: GitHub Copilot CLI and VS Code read the same plugin, and the engine absorbs their differences - see "One plugin, three clients" in `docs/architecture.md`. |
| F-72 | Low | Duplicated rule blocks | Fixed | Shared `severity.md` and `rules.md`; anecdotes in `design-rationale.md`. |
| F-73 | Low | No contrast checker | Fixed | `node engine/cli.mjs contrast` - WCAG ratios from hex, `rgb()` and `oklch()`. |

## Found and fixed beyond the review

- The guard could be bypassed with git's global options (`git -C <dir> reset --hard`), and
  its case-insensitive matching would have let `git checkout -B` through as branch
  creation.
- Creating a working branch at ship was blocked by the guard's own history rule.
- An abandoned run blocked `git commit` in every later session in the repository.
- Two specialists finishing together could lose one report: hooks and the engine now share
  a cross-process ledger lock.
- Undo diffed against the current working tree, so it would also have reversed the user's
  own later edits.
- Skipping tests at implement's own gate never produced the warning it was meant to.
- Read-only specialists had nowhere to put output longer than their report.
- Gradle Kotlin build scripts were counted as Kotlin source in Java projects.

## Open questions for the owner

1. **F-57** - keep the browser and documentation servers declared for every session, or
   make them opt-in at the cost of the live-page step?
2. **F-59** - run the eval suite on a schedule in CI? It needs a model API key as a secret.
3. **F-22** - move the TypeScript examples in `standards.md` into the TypeScript pack, and
   give other packs their own examples?
