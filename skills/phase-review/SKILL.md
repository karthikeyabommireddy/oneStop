---
name: phase-review
description: Review the change with every reviewer the diff surface warrants, running them in parallel, and resolve blocking findings before ship. Binds language, security, database, accessibility and domain reviewers automatically from the diff. Loaded by the orchestrate skill; not usually invoked directly.
version: 1.0.0
user-invocable: false
metadata:
  origin: onestop
  phase: review
---

# Phase - Review

Review the change with everyone whose trigger it touches - automatically. The user
never picks reviewers.

## Reviewer Binding

Compute the diff surface first (`git diff --stat`, plus the file list). Then bind:

| Condition on the diff | Agent | Packs it loads |
|---|---|---|
| Always | `code-reviewer` | every language pack the diff touches |
| Touches any `security_trigger` surface | `security-reviewer` | **mandatory, never skipped** |
| Touches migrations, schema, or query files | `data-reviewer` | `sql` |
| Touches UI where the stack declares the accessibility concern | `a11y-agent` | `accessibility` |
| Touches a declared interface or contract | `contract-agent` | `api-contract` |
| Performance-sensitive change, or perf intent | `performance-agent` | stack packs |
| Always, last | `validator` | - |

**One reviewer, many languages.** A diff spanning TypeScript and Python loads both packs
into a single `code-reviewer` pass rather than running two agents. onestop has no
per-language reviewer agents - the language knowledge lives in `packs/languages/`, and
the role agent applies it.

If the diff contains a language with no matching pack, the reviewer loads
`${CLAUDE_PLUGIN_ROOT}/packs/languages/generic.md` and leans on the repository own conventions. An unknown
language is never a reason to skip the review - but the reviewer must say which files it
reviewed generically.

**Run every bound agent in parallel, dispatched in ONE message.** They are independent
and read-only, so they cannot collide. Agent calls in separate turns are sequential
however they look in the transcript - this is the single most common way a review phase
silently loses its speed. `validator` runs last, in its own turn, because it checks the
others claims.

State the bound set in one line. Do not ask which reviewers to run.

## Severity

Normalise every finding to one scale, because reviewers disagree on wording:

| Severity | Meaning | Gate behavior |
|---|---|---|
| CRITICAL | exploitable, data-destroying, or certain production breakage | **blocks ship** |
| HIGH | a real defect, or a security weakness under plausible conditions | **blocks ship** |
| MEDIUM | correctness or maintainability problem worth fixing now | fix or record |
| LOW | style, naming, minor clarity | optional |
| NOTE | observation, no action implied | informational |

**A hardcoded secret is CRITICAL. Always.** It is never downgraded for being a test
fixture, a placeholder, an example, or already committed. Rotation is part of the fix.

## Deduplication

Several reviewers will report the same issue in different words. Merge them: one
finding, the highest severity claimed, and every reviewer that raised it. A list of
forty findings that is really twelve wastes the reader.

Rank the merged list by severity, then by blast radius.

## Resolving

- **CRITICAL and HIGH must be fixed before Gate 2.** Not deferred, not ticketed, not
  waved past - unless the user explicitly decides otherwise after seeing them, and
  that decision is recorded in the run ledger.
- Fix in place, then **re-run the tests**. A review fix is a code change and gets the
  same verification as any other.
- Re-review only what changed. A full re-review of an unchanged file is waste.
- **MEDIUM** findings are fixed when cheap, and recorded when not.
- Never argue a finding away. Either fix it, or state plainly why it does not apply
  here, with evidence.

## False Positives

Reviewers are wrong sometimes. A finding is dismissed only with a concrete reason -
"the validation happens upstream at `src/mw/auth.ts:22`" - never with "this is fine"
or "intentional". Record the dismissal and its evidence so the next reviewer does not
re-raise it.

## Output

```
REVIEW
  reviewers: <bound set, and why each was bound>
  findings:  <n> CRITICAL, <n> HIGH, <n> MEDIUM, <n> LOW
  blocking:
    - [CRITICAL] <finding>  <path:line>
      fix: <what was changed>  status: fixed | outstanding
  dismissed: <finding, and the evidence that it does not apply>
  retest:    <suite result after the review fixes>
  verdict:   READY FOR GATE 2 | BLOCKED on <n> findings
```

## Rules

1. **Security review is mandatory on a security trigger.** At every tier, no exception.
2. **Never downgrade a hardcoded secret.**
3. **CRITICAL and HIGH block Gate 2.**
4. **Re-run tests after every review fix.**
5. **Deduplicate before reporting.**
6. **Dismiss only with evidence.**
7. **Reviewers are read-only.** Fixes are applied by the orchestrator afterwards, so
   the reviewer verdict stays independent of the fix.
