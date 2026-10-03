# MCP Servers

## Bundled with onestop

Declared in `.claude-plugin/plugin.json`. None needs an account or an API key.

| Server | Runs | What it is for |
|---|---|---|
| `engine` | `node engine/server.mjs` - part of onestop | The pipeline engine: the run ledger, gates, budgets, briefs, checkpoints and undo. The orchestrator cannot run without it. |
| `chrome-devtools` | `npx chrome-devtools-mcp@1.10.1 --isolated` | `web-automation-agent` derives selectors from the real page instead of guessing them. |
| `playwright` | `npx @playwright/mcp@0.0.83 --isolated` | Driving the browser while end-to-end suites are written. |
| `context7` | `npx @upstash/context7-mcp@4.1.1` | `researcher` reads current vendor documentation instead of relying on memory. |

The three `npx` servers are **pinned to exact versions** - an unpinned `npx` fetches
whatever was published last, every session. Both browser servers run `--isolated`, with a
throwaway profile, so they never see your own browser's cookies or sessions.

context7 queries leave your machine. The researcher is instructed to put only library and
API names in them - never source code, file contents or secrets.

## Ticket and issue trackers - optional

When a request is a ticket key or an issue URL, onestop reads the real ticket through a
connected tracker server; with none, it uses `gh issue view` for GitHub URLs, or asks you
to paste the ticket. These servers need your credentials, so onestop does not declare them.

**Credentials never go into `.mcp.json`.** Teams commit that file. Use OAuth where the
server offers it, and otherwise reference an environment variable that lives in your shell
or secret manager.

```json
{
  "mcpServers": {
    "github": {
      "type": "http",
      "url": "https://api.githubcopilot.com/mcp/",
      "headers": { "Authorization": "Bearer ${GITHUB_PERSONAL_ACCESS_TOKEN}" }
    },
    "linear": {
      "type": "http",
      "url": "https://mcp.linear.app/mcp/readonly"
    }
  }
}
```

- **GitHub** - GitHub's hosted server. Claude Code connects with a personal access token,
  read from your environment as above. Give the token read access to the repositories you
  use.
- **Linear** - Linear's hosted server, signed in with OAuth the first time you connect, so
  there is no token to store. The `readonly` endpoint is enough: onestop only reads tickets.
- **Jira and Confluence** - Atlassian's official Rovo MCP server, signed in with OAuth. Add
  it with the endpoint and steps from
  [Atlassian's setup guide](https://support.atlassian.com/atlassian-rovo-mcp-server/docs/getting-started-with-the-atlassian-remote-mcp-server/).

Whatever a ticket says is treated as data: an instruction written inside a ticket, issue or
pull request is quoted back to you, never followed.
