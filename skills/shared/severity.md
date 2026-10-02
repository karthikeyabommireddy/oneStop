# Shared - Severity

One scale for every finding onestop raises - code review, security, data, accessibility,
compliance and validation. Reviewers word things differently; the scale is how their
findings merge into one list the user can act on. Assign exactly one level per finding.

| Severity | Code, security, data, accessibility | Compliance | At the ship gate |
|---|---|---|---|
| **CRITICAL** | exploitable, data-destroying, or certain production breakage | a live violation - regulated data exposed, unencrypted or unlogged right now | **blocks** |
| **HIGH** | a real defect, or a weakness that fails under plausible conditions | a control the regime requires is absent | **blocks** |
| **MEDIUM** | a correctness or maintainability problem worth fixing now | a control present but incomplete or unverified | fixed when cheap, otherwise recorded |
| **LOW** | style, naming, minor clarity | a documentation or process gap, no data exposure | recorded |
| **NOTE** | an observation; no action implied | - | - |

## Absolute Rules

1. **A hardcoded secret is CRITICAL. Always.** Never downgraded for being a test fixture,
   a placeholder, an example, or already committed. Rotation is part of the fix.
2. **Every finding names its failure path** - the concrete input or state that breaks it -
   and cites `path:line`. If you cannot say when it fails, it is a NOTE.
3. **Calibrate honestly.** Inflating severity to seem thorough destroys the signal that
   makes CRITICAL and HIGH worth blocking on. A naming quibble is LOW even when it annoys
   you.
4. **Never soften a security finding**, and never merge one into a lower-severity
   duplicate.

## What Blocks

CRITICAL and HIGH are fixed before the ship gate, or the user accepts a specific one at a
gate and the ledger records it (`run_note`, decision). Never deferred to a ticket in
silence. Each fix attempt is counted with the engine's `loop_attempt` (`review_fix`);
when the budget runs out, the user decides.

## Merging

Several reviewers report the same issue in different words. Merge them: one finding, the
**highest** severity claimed, and every reviewer that raised it. Rank the merged list by
severity, then by blast radius.

## Finding Format

```
[SEVERITY] <one-line claim>                      <path:line>
  why:  <the mechanism - how it actually fails>
  when: <the concrete input or state that triggers it>
  fix:  <the specific change>
```
