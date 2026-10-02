# Reference - PCI DSS v4 engineering controls

Engineering controls to check in a diff. Not legal advice and not a certification - a regime's full obligations are wider than code. Severity is what the reviewer reports when the control is absent from the change.

| Control | Clause | Check in the diff | Severity if absent |
|---|---|---|---|
| No storage of sensitive authentication data | Req. 3.3 | CVV, full track or PIN is never written to storage, logs or caches | CRITICAL |
| PAN rendered unreadable when stored | Req. 3.5 | stored card numbers are tokenised, truncated or strongly encrypted | CRITICAL |
| PAN masked when displayed | Req. 3.4 | UI and logs show at most the first six and last four digits | HIGH |
| Strong cryptography in transit | Req. 4.2 | TLS 1.2+ on every path carrying cardholder data | CRITICAL |
| Prefer the processor's hosted fields | Req. 12.8 / scope | card entry uses the payment provider's hosted UI so card data never touches the app | HIGH |
| Access logged | Req. 10.2 | access to cardholder data is logged without the data itself | HIGH |

Report each control as met, not met (with path:line) or not applicable (with why). A control you could not check is reported as unchecked, never as met.
