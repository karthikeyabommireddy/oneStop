# Reference - HIPAA engineering controls

Engineering controls to check in a diff. Not legal advice and not a certification - a regime's full obligations are wider than code. Severity is what the reviewer reports when the control is absent from the change.

| Control | Clause | Check in the diff | Severity if absent |
|---|---|---|---|
| PHI encrypted in transit | 164.312(e) | TLS on every new endpoint and client carrying PHI | CRITICAL |
| PHI encrypted at rest | 164.312(a)(2)(iv) | new tables, files, caches and queues holding PHI are encrypted | HIGH |
| Access control on PHI | 164.312(a) | every new read of PHI is behind an authorisation check, least privilege | CRITICAL |
| Audit trail | 164.312(b) | access to and changes of PHI are logged with who, what, when - without logging the PHI itself | HIGH |
| No PHI in logs, errors or analytics | 164.502 | grep the diff for logger, exception and analytics calls carrying PHI fields | CRITICAL |
| Minimum necessary | 164.502(b) | responses and exports carry only the PHI the feature needs | MEDIUM |

Report each control as met, not met (with path:line) or not applicable (with why). A control you could not check is reported as unchecked, never as met.
