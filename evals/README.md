# onestop evals

Behavioural checks of the prompts - what onestop actually does when a person types a
request - run with `claude plugin eval`. The engine's logic is covered by
`engine/test/`; these cover the orchestrator, the commands and the specialists' wiring.

Every case stops at or before gate zero. Evals run non-interactively, so no gate can be
answered; that is exactly the boundary that matters most - nothing may change before the
user approves.

```bash
claude plugin eval . --allow-real-servers --scaffold --allow-tools "mcp__plugin_onestop_engine__*"
```

- `--allow-real-servers` starts the real onestop engine. The browser and documentation
  servers are mocked in `mocks/`, so they are not downloaded or started.
- `--scaffold` runs each case's `fixture.sh` to build its repository. Only run it on a
  suite you trust - scaffold scripts run as you.
- Each case runs three times with the plugin and three without; the difference is what
  onestop contributes. For a quick check: `--runs 1 --ablation none`.

Runs call the model with your own credentials and count against your usage.

| Case | Checks |
|---|---|
| `gate-zero-before-any-change` | a defect report is classified as a defect, a run is opened, gate zero is asked, and nothing is edited |
| `greenfield-asks-for-the-stack` | in an empty folder, onestop asks for the language and framework instead of choosing, and writes no code |
| `help-without-a-run` | `/onestop-help` lists the commands and example requests, and starts nothing |
| `status-without-a-run` | `/onestop-status` reports that there is no run, and starts nothing |
