# Reference - GDPR engineering controls

Engineering controls to check in a diff. Not legal advice and not a certification - a regime's full obligations are wider than code. Severity is what the reviewer reports when the control is absent from the change.

| Control | Clause | Check in the diff | Severity if absent |
|---|---|---|---|
| Lawful basis recorded for a new personal-data field | Art. 6 | the field or table carries its purpose and basis in the data model docs | HIGH |
| Erasure reaches the new store | Art. 17 | delete-by-subject covers the new table, cache, index and backup path | HIGH |
| Data minimisation | Art. 5(1)(c) | the field is required by a stated feature | MEDIUM |
| No personal data in logs, analytics or URLs | Art. 32 | grep the diff for logger and analytics calls carrying the field | CRITICAL |
| Access and export path | Art. 15, 20 | the subject-access export includes the new data | MEDIUM |
| Processor or transfer documented | Art. 28, 44 | a new third-party SDK or API receiving the data is listed with its region | HIGH |

Report each control as met, not met (with path:line) or not applicable (with why). A control you could not check is reported as unchecked, never as met.
