# Reference - SOC 2 (Trust Services Criteria) engineering controls

Engineering controls to check in a diff. Not legal advice and not a certification - a regime's full obligations are wider than code. Severity is what the reviewer reports when the control is absent from the change.

| Control | Clause | Check in the diff | Severity if absent |
|---|---|---|---|
| Logical access enforced | CC6.1 | new endpoints and admin actions require authentication and authorisation | HIGH |
| Least privilege | CC6.3 | new roles and tokens get only the scopes they use | MEDIUM |
| Change management | CC8.1 | the change is reviewed, tested and traceable to a requirement | MEDIUM |
| Security events logged | CC7.2 | authentication failures, permission changes and admin actions are logged | HIGH |
| Secrets managed | CC6.1 | no secret in code or config; values come from the secret store | CRITICAL |
| Vulnerabilities monitored | CC7.1 | new dependencies pass the ecosystem audit the project runs | MEDIUM |

Report each control as met, not met (with path:line) or not applicable (with why). A control you could not check is reported as unchecked, never as met.
