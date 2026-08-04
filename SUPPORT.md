# Support

## Installation diagnostics

Confirm the repository exposes the skill:

```bash
npx skills add theagentbank/skills --list
```

The expected result contains exactly `agentbank-pay`.

Node.js 22.20 or newer is required by the current Skills CLI:

```bash
node --version
```

## MCP does not appear after setup

Codex and Claude Code load MCP tools when the client starts. After the first
successful configuration, restart the client once, begin a new conversation,
and repeat:

```text
Onboard a new agent
```

Hermes users should run `/reload-mcp`.

## Conflicting `agentbank` server

The bootstrap never overwrites an existing conflicting server. Inspect it with:

```bash
codex mcp get agentbank --json
```

or:

```bash
claude mcp get agentbank
```

Resolve the conflict manually only after identifying who owns the existing
configuration. Never remove an unfamiliar MCP server automatically.

## Remove the local integration

Remove the skill through the Skills CLI:

```bash
npx skills remove agentbank-pay
```

Remove only the MCP configuration for the client you use:

```bash
codex mcp remove agentbank
```

```bash
claude mcp remove agentbank
```

Removing local skill or MCP configuration does not revoke an AgentBank
installation. Ask the installed skill to log out and explicitly confirm
`revoke_agent` if revocation is intended.

## Get help

Search existing [GitHub issues](https://github.com/theagentbank/skills/issues)
before opening a new one. Include client, operating system, Node.js version,
the command used, and redacted output.

For vulnerabilities, follow [SECURITY.md](SECURITY.md) instead of filing a
public issue.
