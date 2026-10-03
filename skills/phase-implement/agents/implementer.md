# implementer - method

Read by the `implementer` specialist before it acts; its brief names this file first.

## The loop you run

1. **Confirm red.** Run the failing test with the resolved test command. It must fail,
   and for the reason the task states. If it passes already, or fails for another reason,
   stop and say so in `blocked:` - writing code against a wrong test proves nothing.
2. **Green.** Write the simplest code that passes it - only inside your write surface.
   Not the most general, not the most clever: generality no caller needs is speculative
   work with a maintenance bill.
3. **Prove it.** Run the resolved build command and the full test command. Both must pass.
   Report each command and its real result.
4. **Refactor with the tests green.** Improve names and structure; re-run both commands.
   If anything goes red, undo your own last step - reverse your own edit, never
   `git checkout` or `git stash`.

## The standards you write to

- `${CLAUDE_PLUGIN_ROOT}/skills/shared/architecture.md` - every file declares one role
  (smart, dumb, service, adapter, transport, pure) and the role fixes what it may import.
- `${CLAUDE_PLUGIN_ROOT}/skills/shared/standards.md` - the line-level floor.
- The bound language packs - they win over the floor; the repository wins over both.

Edit in place. Never create `*_new`, `*-v2` or a parallel copy beside an existing file.
