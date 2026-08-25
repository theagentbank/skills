# AgentBank Skills

[![Validate](https://github.com/theagentbank/skills/actions/workflows/validate.yml/badge.svg)](https://github.com/theagentbank/skills/actions/workflows/validate.yml)
[![Agent Skills](https://img.shields.io/badge/Agent%20Skills-compatible-111827)](https://agentskills.io)
[![License: MIT](https://img.shields.io/badge/license-MIT-16a34a)](LICENSE)

Official [Agent Skills](https://agentskills.io) for onboarding and operating an
AgentBank payment agent. The skill combines concise safety rules with on-demand
references for identity, recipients, wallets, payments, tracking, and recovery.

## Quick start

1. Install the skill:

   ```bash
   npx skills add theagentbank/skills
   ```

   To select it explicitly, add `--skill agentbank-pay`.

2. Ask your coding agent:

   ```text
   Onboard a new agent
   ```

3. If the AgentBank MCP is missing, the skill safely configures it for Codex or
   Claude Code. Restart that client once when instructed, then repeat the same
   onboarding request.

4. Open the returned AgentBank authorization URL. After approval, the agent
   verifies the installation, account, scopes, and bound wallet.

The Skills CLI installs files only; it does not run repository post-install
hooks. MCP setup begins when the installed skill handles the onboarding request.

## Supported clients

| Client | MCP setup | Reload step |
| --- | --- | --- |
| Codex | Automatic, conflict-safe bootstrap | Start a new conversation after first setup |
| Claude Code | Automatic user-scoped, conflict-safe bootstrap | Restart Claude Code after first setup |
| Hermes | Manual command shown below | Run `/reload-mcp` |

Hermes MCP setup:

```bash
hermes mcp add agentbank --command npx --args -y agent-bank-mcp@latest
```

New installations run the published MCP package without endpoint overrides:

```text
npx -y agent-bank-mcp@latest
```

The package owns the deployed AgentBank endpoint defaults. The bootstrap accepts
the former exact endpoint overrides for upgrade compatibility, but refuses to
replace any other conflicting MCP server named `agentbank`.

The current package stores credentials in a deterministic local AgentBank vault,
so supported client subprocesses share the same profile across restarts. Normal
installs keep an empty environment: do not add endpoint, profile, credential
store, or secret settings unless an operator explicitly manages that host.

## What the skill covers

- Agent onboarding, readiness, scopes, logout, and per-installation approval
  policy
- KYC, World ID handoffs, and AgentKit wallet verification
- Live route discovery and recipient-free payment estimates
- Fiat and crypto recipient canonicalization
- Shared Privy wallet balances and server-owned instruction execution
- Direct and explicit two-hop payments
- Multi-payment plans with one reviewed approval
- Durable tracking, cancellation, correction, and safe recovery

The main [`SKILL.md`](skills/agentbank-pay/SKILL.md) stays compact and loads
focused files from `references/` only when a workflow needs them.

## Safety model

- The skill never asks for private keys, seed phrases, JWTs, Privy tokens, or
  World ID proofs.
- Existing conflicting MCP configuration is reported and never overwritten.
- Payment creation and execution require explicit human confirmation.
- AgentBank Core remains authoritative for routes, approvals, instructions,
  transaction verification, and terminal payment state.
- Receipts and transaction hashes are evidence; only `get_payment` determines
  payment completion.

Review installed skills before use: agent skills can instruct coding agents to
run local commands and call connected tools.

## Requirements

- Node.js 22.20 or newer (required by the current Skills CLI)
- Internet access for `npx`, AgentBank, and authorization pages
- Codex, Claude Code, or Hermes with local MCP support

For installation and MCP troubleshooting, see [SUPPORT.md](SUPPORT.md). Report
vulnerabilities using [SECURITY.md](SECURITY.md).

## Development

```bash
npm ci
npm run check
npm run smoke:install
npm run smoke:mcp
```

Maintainers can detect protocol drift with:

```bash
npm run check:protocol-drift -- --target ../protocol-core
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for the source-of-truth and generated
compatibility workflow.

## License

[MIT](LICENSE)
