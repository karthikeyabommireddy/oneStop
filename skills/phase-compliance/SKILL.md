---
name: phase-compliance
description: Check a change against the regulatory regime its data and domain actually place it under - HIPAA, GDPR, PCI-DSS, SOC 2 - and report control findings with severity. Loaded by the orchestrate skill when a regulated data path is detected.
version: 1.0.0
user-invocable: false
metadata:
  origin: onestop
  phase: compliance
---

# Phase - Compliance

Check the change against the regime that actually applies. Domain is detected from the
data the code touches, not asked.

## Regime Detection

| Signal in the change surface | Regime | Reference |
|---|---|---|
| Patient, clinical, diagnosis, medical record, FHIR, HL7 | HIPAA | `references/hipaa.md` |
| EU users, personal data, consent, right to erasure, data subject | GDPR | `references/gdpr.md` |
| Card number, PAN, CVV, cardholder, payment processing | PCI-DSS | `references/pci-dss.md` |
| Access control, audit logging, change management on a SaaS product | SOC 2 | `references/soc2.md` |

More than one regime can apply at once - card data belonging to EU users is both PCI
and GDPR. Apply every regime that matches; do not pick one.

If no signal matches, skip the phase and say so in one line. Do not manufacture a
compliance review for a change that does not touch regulated data.

## What to Check

Load only the matched reference file, and check the change against its controls.
Across every regime, these are the surfaces that actually fail audits:

- **Data at rest and in transit** - is regulated data encrypted, with a key management
  story that is not "a constant in the repo"?
- **Access control** - is access least-privilege, and enforced server-side rather than
  hidden in the UI?
- **Audit trail** - is access to regulated data logged, with actor, subject, time and
  action, in a log that cannot be silently edited?
- **Retention and deletion** - is there a defined lifetime, and can a subject actually
  be erased, including from backups and derived stores?
- **Minimisation** - is regulated data collected and retained only where it is needed?
  The cheapest control is not holding the data.
- **Leakage paths** - regulated data in logs, error messages, analytics payloads,
  crash reports, URL parameters, or a third-party SDK. This is the most common real
  finding and the easiest to miss in review.
- **Third parties** - does regulated data reach a processor, and is that relationship
  covered?

## Severity

| Severity | Meaning |
|---|---|
| CRITICAL | a live violation - regulated data exposed, unencrypted, or unlogged right now |
| HIGH | a control absent where the regime requires one |
| MEDIUM | a control present but incomplete or unverified |
| LOW | documentation or process gap, no data exposure |

CRITICAL and HIGH block Gate 2, exactly as in the review phase.

## Boundaries

This phase reports engineering control findings against a published regime. It is not
a legal opinion, and it does not certify compliance. State that plainly in the output
so nobody mistakes a green report for an audit result.

## Output

```
COMPLIANCE
  regimes:  <detected, and the signal that triggered each>
  surface:  <the regulated data paths this change touches>
  findings:
    - [HIGH] <control> - <what is missing>  <path:line>
      remediation: <the specific change required>
  passed:   <controls verified, briefly>
  note:     engineering control review, not a legal opinion or certification
```

## Rules

1. **Detect the regime; never ask for it.** The data says which apply.
2. **Apply every matching regime**, not just the most obvious one.
3. **Check the leakage paths** - logs, analytics, crash reports, third-party SDKs.
4. **CRITICAL and HIGH block ship.**
5. **Never claim compliance.** Report control findings and say what this is not.
6. **Skip cleanly** when no regulated data is involved, and say so.
