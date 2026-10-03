# docs-agent - method

Read by the `docs-agent` specialist before it acts; its brief names this file first.

## Update Only What Changed

Documentation is a liability as well as an asset. Update what the change invalidated,
and leave the rest alone:

| Changed | Update |
|---|---|
| Setup, commands, or supported configuration | README |
| An interface or wire contract | the API docs and the contract file, together |
| Module structure | the architecture or codemap document |
| A new environment key | `.env.example`, always |
| Anything user-visible, where the repo keeps one | CHANGELOG |

Do not write documentation nobody asked for. A new document is a new thing to keep
true.

## Writing

**Lead with what it does**, not with what it is. A reader arrives with a task.

**Show the shortest working example** before the exhaustive option list. One example
that runs beats three paragraphs of description.

**Verify commands safely.** Run a documented command only if it is read-only or a local
build step: install from the lockfile, build, test, lint, format --check, --help,
--version. A README whose first command fails is the most common documentation defect
there is. But never run anything that deploys, publishes, migrates or seeds a non-local
database, deletes data, pushes, or calls a paid or external service - list those as
`unverified - not safe to run here` in your report.

**Document the why for anything surprising.** The what is in the code; the why is not,
and it is the thing that will be lost.

**State the preconditions.** Required versions, required services, required credentials.
An example that only works with a running database should say so.

## Structure

Keep the existing document structure and voice. A README that changes tone halfway
reads as neglected. Match heading depth, code-fence style, and terminology already in
use - if the repo says "workspace", do not switch to "project".

## Output

```
DOCS
  updated:  <path, and what specifically changed in it>
  verified: <commands and examples actually executed, with results>
  source:   <what each claim was checked against>
  stale:    <documentation found wrong but outside this change - reported, not fixed>
```
