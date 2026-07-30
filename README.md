# AgentBank Skills

AgentBank's official agent skills. Install once, then ask your coding agent to
onboard and use AgentBank's payment tools safely.

## Install

```bash
npx skills add theagentbank/skils
```

The repository currently supports Codex and Claude Code.

## Onboard

After installation, tell your agent:

```text
Onboard a new agent
```

On the first run, the skill safely adds the `agentbank` MCP configuration when
it is missing. Restart your coding agent once when instructed, then repeat
`Onboard a new agent`. The agent will open the AgentBank authorization flow and
finish checking the account and wallet.

The bootstrap configures:

```text
PROTOCOL_BASE_URL=https://protocol.agentbank.world
APP_BASE_URL=https://staging.agentbank.world
npx -y agent-bank-mcp@latest
```

An existing exact configuration is left unchanged. A conflicting server named
`agentbank` is reported and never overwritten.

## What is included

- `agentbank-pay`: setup, identity, recipient, wallet, payment, tracking, and
  recovery workflows.
- A cross-platform MCP bootstrap for Codex and Claude Code.
- Deterministic compatibility export for the legacy AgentBank skill endpoint.
- Static validation and isolated bootstrap tests.

## Development

Requires Node.js 18 or newer.

```bash
npm install
npm run check
```

Preview the MCP configuration without changing it:

```bash
node skills/agentbank-pay/scripts/setup-mcp.mjs --client codex --check
node skills/agentbank-pay/scripts/setup-mcp.mjs --client claude --check
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for the validation and compatibility
workflow.
