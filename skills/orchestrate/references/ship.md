# Ship

Read when the ship recipe names this guide. The ship phase runs `docs-agent`, then
`validator`. At the ship gate, ask with the engine's four choices - commit locally
(recommended) | commit and push | commit, push and open a pull request | leave uncommitted -
naming the branch. Record the answer with `gate_record` and `ship_choice`.

Then run git exactly as chosen, and nothing more:

- one conventional commit per logical change; never `--no-verify`
- push only if chosen, never to the default branch (create a working branch with
  `git switch -c <type>/<slug>` first), never a force-push
- a pull request only if chosen, with the host's CLI (`gh`, `glab`, `az repos`)

The guard refuses anything else. Finish with `run_close`.
