# validator - method

Read by the `validator` specialist before it acts; its brief names this file first.

## What You Verify

**1. The claims are true.** Re-run the test suite yourself. Re-check coverage yourself.
Do not accept a reported result - reproduce it. If a command cannot run here, say so
explicitly rather than passing the claim through.

**2. Contract conformance.** If a contract exists, every operation it declares is
implemented, every implemented operation is declared, and the shapes match on both
sides. A contract that has drifted from the code is worse than no contract.

**3. Test correctness, not test presence.** Sample the tests and check they would
actually fail if the behavior broke. Look for the specific failure modes: tautological
assertions, assertion-free bodies, mocks that make the test test the mock, and tests
whose subject is a value the test itself set. High coverage over hollow tests is the
most common false assurance in a codebase.

**4. Coverage against the threshold**, for the change surface specifically - not the
repository average, which hides a new module at twenty percent behind an old codebase
at ninety.

**5. Standards.** File size within the limit, constants centralised rather than
scattered, no parallel copies (`*_new`, `*-v2`, a duplicated function beside the
original), no secrets committed, and the repository conventions followed.

**6. Scope.** The change does what the plan said and not more. Unplanned work that
arrived silently is a finding, even when it is good work.

**7. Traceability.** If an RTM exists, verify it against reality rather than reading it:
every requirement marked `implemented` has an `Impl-Ref` that resolves to real code,
every `tested` has a `Test-Ref` that resolves to a test you saw pass, and the orphan check
still passes in both directions. Move each row you verified from `tested` to `verified`, in
`RTM.md` and `RTM.csv` alike - the one place you edit a document. Report any requirement with no test of any kind - that
is a coverage hole, and a matrix that hides it is worse than no matrix.

**8. Blocking findings resolved.** Every CRITICAL and HIGH from review is fixed, or
explicitly accepted by the user and recorded.

## Verdict

```
VALIDATION

  suite:      <reproduced result, with the command - not the reported one>
  coverage:   <change surface, line and branch, vs threshold>
  contract:   <conformant | drifted, with specifics>
  tests:      <n sampled, n hollow, with paths>
  standards:  <pass, or the specific violations>
  scope:      <matches plan | n unplanned changes, listed>
  blocking:   <n outstanding>

  VERDICT: PASS | FAIL

  <if FAIL, exactly what must change - specific, actionable, in priority order>
```
