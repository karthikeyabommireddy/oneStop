# onestop operating rules

These apply to every agent and every phase. A phase skill may add rules; none may
contradict these.

## Authority order

When guidance conflicts, the higher item wins:

1. An explicit instruction from the user in this conversation.
2. The repository: `CLAUDE.md`, `AGENTS.md`, `CONTRIBUTING.md`, lint and format config.
3. Conventions the repository demonstrates in code near the change.
4. `.onestop/stack.yml`, then detected stack bindings.
5. These rules and the phase skills.
6. Language and concern pack defaults.

**The repository always outranks the plugin.** onestop adapts to a codebase; it never
reshapes one to its own preferences.

## Asking

Ask only when information is genuinely missing, or discovery surfaced two or more real
options that lead to materially different work. Search first - an unsearched question is
a banned question. Batch every open question for a phase into one interruption, present
evidence, rank the options, recommend one, and name the default so `go` is a valid
answer.

Never ask which agent, skill, phase or intent to use. That is the orchestrator job.

## Evidence

Every claim about the codebase carries a `path:line`. A finding without a location is an
opinion. A confident negative - "searched these terms, nothing exists" - is a first-class
result and is what lets a phase proceed without asking.

Query the knowledge graph before opening files. The graph locates; the file explains.

## Changing code

Edit in place. Never `*_new`, `*-v2`, `*.updated`, a parallel component with a suffix, or
a second tree beside an existing one. New files are for genuinely new modules.

Test first. No production code before a failing test that justifies it, and that test
must fail for the expected reason.

The suite is green at every slice boundary, not only at the end.

Never weaken, skip or delete a test to get a green result. Never lower a coverage
threshold or exclude a file to reach it. Never silence a compiler diagnostic to clear a
build. Fix the cause.

## Security and secrets

A hardcoded secret is CRITICAL, always - never downgraded for being a test fixture, a
placeholder, an example, or already committed. Remediation includes rotation.

Security review is mandatory whenever the change surface touches a security trigger, at
every size tier, with no exception for urgency.

## Honesty

Report what happened. If a phase was skipped, say so and why. If tests failed, show the
output. If a suite could not run here, say what is missing rather than implying it
passed. If the knowledge graph is stale or absent, say so before relying on file reads.

A confident wrong report is the most expensive thing this pipeline can produce.

## Gates

No implementation before Gate 1 approval. Nothing committed, pushed or published before
Gate 2 approval. CRITICAL and HIGH findings block Gate 2 unless the user explicitly
accepts them, and that acceptance is recorded in the run ledger.

## Cost

One phase skill loaded at a time. Delegate bulk generation to subagents and return only
summaries. Never echo written file bodies into chat. Pass extracts, not whole artifacts.
Run independent discovery and independent reviewers in parallel - sequential fan-out is
the largest avoidable waste in the pipeline.
