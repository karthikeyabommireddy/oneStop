---
name: phase-upgrade-plan
description: Plan a dependency, runtime or framework upgrade - current and available versions from the official registry, the breaking changes between them, the call sites they hit, and the user's choice of target version as the gate that authorises implementation. Loaded by the orchestrate skill for upgrade intent; not usually invoked directly.
version: 2.0.0
user-invocable: false
metadata:
  origin: onestop
  phase: upgrade-plan
---

# Phase - Upgrade Plan

An upgrade fails in one of three ways: the wrong target version, a breaking change nobody
read, or a suite that was never green to begin with. This phase closes the first two; the
verify-green phase that follows closes the third.

**The target version is the user's decision.** This phase recommends one and says why. It
never picks it.

## Dispatch

`researcher`, in upgrade mode, read-only. It edits no manifest and no lockfile and
installs nothing. Its findings file is the plan the user approves.

## Procedure

**1. What is installed.** Read the exact current version from the lockfile, not the
manifest range - `^4.2.0` in a manifest says nothing about what actually runs. Note every
package that moves with it: peer dependencies, companion packages released in lockstep
(`@types/*`, `*-dom`, `Microsoft.EntityFrameworkCore.*`), and the plugins that pin a
major.

**2. What is available - today, from the registry.** Never from memory.

| Ecosystem | Versions | Outdated / audit (if already installed) |
|---|---|---|
| npm, pnpm, yarn | `npm view <pkg> versions --json`, `npm view <pkg> time --json` | `<pm> outdated`, `<pm> audit` |
| Python | `pip index versions <pkg>` | `pip list --outdated`, `pip-audit` |
| .NET | `dotnet package search <pkg> --exact-match` | `dotnet list package --outdated`, `--vulnerable` |
| Go | `go list -m -versions <module>` | `go list -m -u all`, `govulncheck ./...` |
| Rust | `cargo search <crate> --limit 1`, `cargo info <crate>` | `cargo outdated`, `cargo audit` |
| Java | the Maven Central search API for the coordinates | `mvn versions:display-dependency-updates`, `gradle dependencyUpdates` |
| Ruby | `gem info -r <gem>` | `bundle outdated`, `bundle audit` |
| Runtimes | the vendor's release page (Node, Python, .NET, Go, JDK) | - |

Use the project's package manager, the one the lockfile belongs to. Run an outdated or
audit tool only if it is already installed - never install one to answer this question.
If the registry cannot be reached, say so and stop; a version list from memory is the
exact failure this phase exists to prevent.

**3. The candidate targets.** At most three, each a real published version:

- the latest patch of the current major (lowest risk),
- the latest minor of the current major,
- the latest stable release - the newest major, never a pre-release unless the user's
  request named one.

Runtime and framework LTS status comes from the vendor's release schedule, with the
end-of-support date.

**4. What breaks between them.** From the official changelog, release notes or migration
guide - linked, never paraphrased from memory. For each breaking change: what changed,
whether this repository uses it (search for the API by name; query the graph with
`graphify explain`), and the call sites with `path:line`. A breaking change with no call
site in this repository is listed as not applicable, not omitted.

**5. Risk.** Advisories fixed by each candidate (and any it introduces), the peer
dependencies that must move together, and whether a codemod or official migration tool
exists (`npx @next/codemod`, `dotnet upgrade-assistant`, `ng update`, `rector`). A codemod
is named as an option; it is run in implement, only after the user approves the plan.

## The Plan

`docs/research/<slug>/upgrade-plan.md`, unless the brief names the repository's own
documentation home:

```
UPGRADE PLAN  <package>  <installed exact version>  (from <lockfile>)
  verified:    <today's date>, <registry or source consulted>

  candidates
    <version>  <patch | minor | major>  released <date>  <LTS / support window>
      fixes:    <advisories closed>
      breaking: <n> applicable, <n> not applicable
      moves with: <peer and companion packages, to which versions>

  breaking changes in this repository
    <change>   <path:line, ...>   <the edit it needs>   <link>

  recommendation: <version> - <the reason in one line>
  implement will: update the manifest and the lockfile with <package manager>, apply the
                  breaking-change edits, then run build, test and the audit again
```

The REPORT returns the recommendation and the candidates under `open:`, so the
orchestrator puts the choice to the user.

## Gate

The upgrade-plan gate is the authorising gate for implement. It asks one question: which
target version, with the candidates as options and the recommendation marked. The answer
is recorded as an approval - `run_note` with `kind: "approval"`, `approval_kind:
"dependency"`, `item: "<ecosystem>:<package>@<version>"`, one per package that moves -
which is what lets implement change the lockfile without the guard refusing it. Verify-green runs after this gate, so the baseline is
proven on the code that is about to change.

## Rules

1. **Never choose the target version.** Recommend it; the user decides.
2. **Every version from the registry, today.** Never from memory, never from a blog post.
3. **Read from the lockfile, not the manifest range.**
4. **Every breaking change gets a verdict for this repository** - applicable with call
   sites, or not applicable.
5. **Edit no manifest or lockfile, install nothing.** That is implement's job, after the
   gate.
6. **A pre-release is never a candidate** unless the user's request named one.
