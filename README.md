# AgentBank Skills

AgentBank's official agent skills. Install once, then ask your coding agent to
onboard and use AgentBank's payment tools safely.

## Install

```bash
npx skills add theagentbank/skills
```

The repository supports Codex and Claude Code with an automated bootstrap, and
Hermes with the MCP command documented by the skill.

## Onboard

After installation, tell your agent:

```text
Onboard a new agent
```

On the first run, the skill safely adds the `agentbank` MCP configuration when
it is missing. Restart your coding agent once when instructed, then repeat
`Onboard a new agent`. The agent will open the AgentBank authorization flow and
finish checking the account and wallet.

New Codex and Claude installations configure:

```text
npx -y agent-bank-mcp@latest
```

The published package supplies the deployed AgentBank endpoint defaults, so the
bootstrap does not add environment overrides. An existing exact configuration
is left unchanged. For upgrade compatibility, the former exact AgentBank
endpoint overrides are also accepted. Any other conflicting server named
`agentbank` is reported and never overwritten.

For Hermes, install and reload manually:

```bash
hermes mcp add agentbank --command npx --args -y agent-bank-mcp@latest
```

Then run `/reload-mcp`.

## What is included

- `agentbank-pay`: setup, identity, recipient, wallet, payment, tracking, and
  recovery workflows.
- A cross-platform MCP bootstrap for Codex and Claude Code, plus Hermes
  installation guidance.
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
