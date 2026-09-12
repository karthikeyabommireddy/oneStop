---
name: phase-design
description: Produce the design artifacts a change needs and no more - interface contract, low-level design, and an ADR for decisions that are expensive to reverse. Scales from a single contract file to a full HLD. Loaded by the orchestrate skill; not usually invoked directly.
version: 1.0.0
user-invocable: false
metadata:
  origin: onestop
  phase: design
---

# Phase - Design

Produce the design a change actually needs. Design documents that nobody reads are a
tax on the team, so this phase is deliberately scaled to blast radius.

## What to Produce, by Tier

| Tier | Artifacts |
|---|---|
| trivial, small | none - the plan is the design |
| standard | interface contract if two or more components meet; a short LLD section in the plan |
| large | HLD, LLD, interface contract, and one ADR per expensive decision |

Never produce an HLD for a change that touches one module. Never skip the contract
when two components have to agree on a wire format.

## The Interface Contract

**Mandatory whenever two or more components exchange data.** This is the single
highest-value design artifact, because it lets the components be built and tested
independently and it makes integration failures impossible to discover late.

Pick the format from how the components actually talk:

| Boundary | Format |
|---|---|
| REST over HTTP | OpenAPI 3.1 (`openapi.yaml`) |
| GraphQL | SDL schema |
| gRPC | `.proto` |
| Events, queues, streams | AsyncAPI |
| In-process or library | a typed interface file in the host language |

The contract is written and agreed **before** either side is implemented. Every
operation specifies request shape, response shape, every error status, and the
validation rules at the boundary. An operation whose error cases are unspecified is
not specified.

Present a condensed operation table for review - method, path, purpose, status codes -
never the full document body in chat.

## Low-Level Design

For each module the plan touches, state only what the implementer cannot infer:

- The data model changes, including migration direction and whether it is reversible.
- Where validation happens, and what is trusted after it.
- Error taxonomy: what is retried, what surfaces to the user, what is logged, and
  what must never be swallowed.
- Concurrency and ordering assumptions, if any exist. Unstated ones become defects.
- The extension seam, if this is deliberately built to grow.

Follow the conventions discovery recorded. A design that contradicts the repo existing
patterns needs a stated reason, or it should not contradict them.

## Architecture Decision Records

Write an ADR only for a decision that is **expensive to reverse** - a datastore, a
public contract, an auth model, a framework, a boundary between services. One page:

```
# ADR-<n>: <decision>
Status:   accepted
Context:  <the forces - what made this a decision rather than a default>
Decision: <what was chosen, stated plainly>
Options:  <what else was viable, and why it lost>
Consequences: <what this makes easy, what it makes hard, what it forecloses>
```

Do not write an ADR for a reversible choice. The option-broker already resolved those.

## Accessibility and Security by Design

- If the stack sets `a11y_required` and the change touches UI, the design names the
  semantic structure, focus order, and the accessible name of every interactive
  element - before implementation, not as a later audit.
- If the change touches a `security_trigger` surface, the design names the trust
  boundary, what is validated where, and how secrets reach the code.

## Output

Write artifacts to the repo `docs/` directory, following its existing layout. Report
the paths and the key decisions - never echo the document bodies into chat.

## Rules

1. **Contract before implementation** whenever two components meet.
2. **Scale to blast radius.** No HLD for a one-module change.
3. **An ADR is for irreversible decisions only.**
4. **Follow the repo conventions** discovery found, or state why not.
5. **Specify error cases.** An interface without them is unfinished.
6. **Never echo full documents into chat.** Paths and decisions only.
