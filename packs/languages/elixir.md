# Pack: Elixir / Phoenix

**Runner** ExUnit (`mix test`).
**Detecting it** `mix.exs`.

## Review focus

**Let it crash, deliberately.** Supervision trees are the error strategy; a `try/rescue`
wrapping everything defeats the design. But an unsupervised `Task.start` that dies takes
its work with it silently — use `Task.Supervisor`.

**Pattern matching over conditionals.** A function head matching `{:ok, x}` and `{:error,
e}` separately beats a `case` inside one body. An unmatched clause raising
`FunctionClauseError` is often correct — it fails loudly at the boundary.

**GenServer.** State mutation must go through the process. A long-running `handle_call`
blocks the whole GenServer — move work to `handle_cast` or a Task. `handle_info` needs a
catch-all clause or unexpected messages crash it.

**Ecto.** `Repo.preload` or a join for associations in a loop — the N+1 exists here too.
Changesets are the validation boundary; `Repo.insert` on a struct bypasses them entirely.
`Ecto.Multi` for anything that must be transactional.

**LiveView.** Assigns are diffed and sent over the wire — putting a large structure in
assigns sends it on every update. `temporary_assigns` for lists that only append.
Every `handle_event` must be authorised: the client can send any event name.
