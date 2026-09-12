---
name: phase-ship
description: Close the loop after review - conventional commits scoped to logical changes, a pull request with the repo template, and documentation sync. Owns the ship gate, the last stop before anything leaves the machine. Loaded by the orchestrate skill; not usually invoked directly.
version: 1.0.0
user-invocable: false
metadata:
  origin: onestop
  phase: ship
---

# Phase - Ship

Turn a finished change into a delivered one. This phase owns **the ship gate** - the last
point before anything becomes visible outside this machine.

## Preconditions

- The suite is green, and the result was actually observed.
- Coverage meets the threshold.
- Every CRITICAL and HIGH review finding is resolved, or explicitly accepted by the
  user and recorded.

If any is unmet, stop and report. Do not ship past an unresolved blocker.

## The Ship Gate

Present this and **wait**. Nothing is committed, pushed, or published before approval:

```
READY TO SHIP - <one-line summary>

CHANGES
  <files changed / insertions / deletions>
  <the tree of touched areas, not the diff body>

VERIFICATION
  suite:    <result, with the command>
  coverage: <line and branch for the change surface, vs threshold>
  review:   <n resolved, n accepted, by severity>
  automation: <suites and whether they executed>

PROPOSED COMMITS
  1. feat(auth): add Google provider to next-auth
  2. test(auth): cover Google sign-in and account-linking paths

THEN
  branch: <name>   push: yes/no   PR: <title, or none>

Approve to ship, or tell me what to change.
```

The ship gate always stops - in every gate mode and at every tier, including `trivial`.

## Commits

- **Conventional commits**: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`,
  `perf`, `build`, `ci`. Scope is the module or area.
- **One commit per logical change**, not one per file and not one giant commit. A
  reviewer should be able to read the history and follow the reasoning.
- The subject says what changed and why in under about 72 characters. The body carries
  the reasoning when it is not obvious - never a restatement of the diff.
- **Never** `--no-verify`, and never bypass signing. If a hook fails, fix the cause.
- If the current branch is the default branch, create a working branch first.
- Append the repo required trailers if it configures any.

## Pull Request

Only when the user asked for one, or the repo workflow clearly expects one.

1. Discover the template: `.github/pull_request_template.md`, then
   `.github/PULL_REQUEST_TEMPLATE/`, then `docs/`. **Fill the repo template** rather
   than imposing a different structure.
2. Push the branch, then open the PR with `gh pr create`.
3. The body states what changed, why, how it was verified, and anything a reviewer
   should look at closely. Link the ticket when the run came from one.
4. Never auto-merge. Never request review from people the user did not name.

## Documentation

Sync only what the change actually invalidated:

- README, when setup, commands, or supported configuration changed.
- API docs and the OpenAPI file, when the contract changed - the contract and the docs
  must not disagree.
- Codemaps, when the module structure changed.
- CHANGELOG, when the repo keeps one.
- `.env.example`, for every environment key introduced.

Read the source of truth - routes, schemas, exports, scripts - never document from
memory. Do not write documentation nobody asked for; a stale doc is worse than none.

## Output

```
SHIP
  commits: <hashes and subjects>
  branch:  <name>   pushed: <yes/no>
  pr:      <url, or not created>
  docs:    <files updated>
  ledger:  run marked complete
```

Mark the run `status: complete` in `.onestop/run.json`.

## Rules

1. **Never commit, push, or publish before the ship gate approval.** Not even a WIP commit.
2. **Never ship with an unresolved CRITICAL or HIGH finding.**
3. **Never commit a secret.** Scan the staged diff before committing; a hit stops the
   ship and the credential must be rotated, not just removed.
4. **Never use `--no-verify` or bypass signing.**
5. **Never force-push a shared branch.**
6. **Never auto-merge.**
7. **Report the real state.** If the push failed, say so - never imply delivery that
   did not happen.
