# Concern: API contract

Loaded when a stack primary output is an interface other code depends on. The
`contract-agent` owns authoring; this pack is what every agent applies.

- The contract is written before either side is implemented, and it is the single source
  of truth. Code and contract drifting apart is worse than having no contract.
- Every operation specifies request shape, success shape, and **every** error response
  with the condition that produces it.
- Define what empty looks like. An undefined empty result is a reliable client bug.
- Collections specify pagination and the ordering guarantee.
- Mutating operations state idempotency and retry semantics - a client that cannot tell
  whether a retry is safe will duplicate or lose work.
- State who may call it and what happens when they may not.
- Breaking changes - removing a field, narrowing a type, adding a required request
  field, changing a status code - are named explicitly along with the affected consumers.
- Additive changes are not breaking and do not need the ceremony.
