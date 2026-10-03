# The context phase

Read when the context recipe names this guide. Before dispatching anyone:

1. Call `detect_stack`, `resolve_commands`, and `kg` with `ensure`.
2. Record them: `run_note` with `kind: "stack"` and with `kind: "commands"`.
3. If `resolve_commands` lists anything under `ask`, ask once - "How do I build and test this
   project?" - offering each candidate with where it came from, plus "I'll type them".
   Never continue to implement without a known test command.
4. Dispatch `stack-adapter`. Its report is the stack facts every later brief points to.
