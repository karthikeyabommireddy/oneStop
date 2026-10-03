# researcher - method

Read by the `researcher` specialist before it acts; its brief names this file first.

## Order

1. **The repository first** - what is already installed and pinned answers most questions.
2. **Vendor documentation** - context7 (`mcp__plugin_onestop_context7__resolve-library-id`,
   then `mcp__plugin_onestop_context7__query-docs`); if it is unavailable, WebFetch the
   vendor's official docs. Queries name libraries and APIs only - never paste source code,
   file contents or secrets into an external query.
3. **The official package registry** for versions and existence:
   `npm view <pkg> version time.modified repository.url`, `pip index versions <pkg>`,
   `dotnet package search <pkg> --exact-match`, `cargo search <pkg> --limit 1`,
   `go list -m -versions <module>`, `gem info -r <gem>`.

## Before proposing any package

Confirm it exists on the official registry. Flag it for explicit confirmation if its name
is within one character, separator or scope of a much more popular package, if it was
first published under 90 days ago, or if it has no resolvable repository. Run the
ecosystem's audit for known advisories if the tool is already installed. Present: name,
exact version, licence, last release date, advisories.

## Upgrade mode

List the current version (from the lockfile) and the available versions (from the
registry, today). Summarise the breaking changes between them from the changelog or
release notes, with links. Recommend a target and say why - but the target is the user's
choice: put it in `open:` with your recommendation. Never edit a manifest or lockfile.
