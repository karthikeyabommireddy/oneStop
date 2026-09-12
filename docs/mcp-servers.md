# MCP servers

onestop declares three servers, all zero-config — no API key, no account, `npx` fetches
them on first use:

| Server | Why onestop needs it |
|---|---|
| `chrome-devtools` | `web-automation-agent` derives selectors from the **real page** rather than guessing. Without a browser server it cannot, and a real run silently borrowed another plugin's. |
| `playwright` | Driving the browser during the automation phase. |
| `context7` | `phase-research` is told to consult vendor documentation before recommending net-new code. |

## Ticket ingestion — opt in, needs credentials

`skills/orchestrate/SKILL.md` probes for these when the request is a ticket ID or issue
URL. They are **not declared by default** because each needs credentials, and a declared
server that cannot authenticate produces connection noise on every session. A failed
probe is harmless — onestop falls back to asking you to paste the ticket.

Enable the ones you use by adding them to your own `.mcp.json`:

```json
{
  "mcpServers": {
    "github":    { "command": "npx", "args": ["-y", "@modelcontextprotocol/server-github"],
                   "env": { "GITHUB_PERSONAL_ACCESS_TOKEN": "<token>" } },
    "atlassian": { "command": "uvx", "args": ["mcp-atlassian==0.21.0"],
                   "env": { "JIRA_URL": "<url>", "JIRA_USERNAME": "<email>", "JIRA_API_TOKEN": "<token>" } },
    "linear":    { "command": "npx", "args": ["-y", "@modelcontextprotocol/server-linear"],
                   "env": { "LINEAR_API_KEY": "<key>" } }
  }
}
```

Tool names onestop probes for, in order: `mcp__atlassian__get_issue`,
`mcp__jira__getIssue`, `mcp__jira__get_issue`, `mcp__github__get_issue`,
`mcp__linear__getIssue`.
