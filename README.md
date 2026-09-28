# AgentBank Skills

[![Validate](https://github.com/theagentbank/skills/actions/workflows/validate.yml/badge.svg)](https://github.com/theagentbank/skills/actions/workflows/validate.yml)
[![Agent Skills](https://img.shields.io/badge/Agent%20Skills-compatible-111827)](https://agentskills.io)
[![License: MIT](https://img.shields.io/badge/license-MIT-16a34a)](LICENSE)

Official [Agent Skills](https://agentskills.io) package for the AgentBank
`agentbank-pay` skill: set up the AgentBank MCP (local or hosted over OAuth),
handle identity, send and collect money, manage recipients and spending limits,
track payments, and recover safely.

## Quick start

```bash
npx skills add theagentbank/skills
```

To select it explicitly, add `--skill agentbank-pay`. Then ask your agent, for
example, `Onboard a new agent`, and follow the skill.

The Skills CLI installs files only; it does not run repository post-install
hooks.

## Source of truth

The skill text is authored in the AgentBank backend and published live at
<https://useagentbank.com/SKILL.md> (served from
<https://protocol.useagentbank.com/SKILL.md>). This repository only repackages
that file for `npx skills add theagentbank/skills`:

- [`skills/agentbank-pay/SKILL.md`](skills/agentbank-pay/SKILL.md) keeps the
  backend frontmatter, title, and core sections in backend order, plus the
  packaging frontmatter keys from [`packaging.json`](packaging.json).
- Every other backend section is moved unchanged into
  [`skills/agentbank-pay/references/`](skills/agentbank-pay/references/), and
  `SKILL.md` gets one generated `Read [...]` pointer line in its place. The
  mapping lives in [`skill-layout.json`](skill-layout.json).
- [`dist/agentbank-pay/SKILL.md`](dist/agentbank-pay/SKILL.md) is the backend
  file byte for byte; its sha256 is recorded in
  [`protocol-core-sync.json`](protocol-core-sync.json).

**Edits to skill wording must go to the backend.** Pull requests that edit the
generated files here will be overwritten by the next import. The
[Import backend skill](.github/workflows/import-backend-skill.yml) workflow
checks the backend hourly (and on `repository_dispatch` type
`backend-skill-updated`) and opens a pull request from
`automation/import-backend-skill` when it changes.

## Requirements

- Node.js 22.20 or newer (required by the current Skills CLI)
- Internet access for `npx`, AgentBank, and authorization pages

For installation and MCP troubleshooting, see [SUPPORT.md](SUPPORT.md). Report
vulnerabilities using [SECURITY.md](SECURITY.md). Review installed skills before
use: agent skills can instruct coding agents to run local commands and call
connected tools.

## Development

```bash
npm ci
npm run import:backend   # regenerate from https://protocol.useagentbank.com/SKILL.md
npm run check            # offline: structure, round-trip, tests
npm run check:backend    # online: generated files match the live backend
npm run check:public-skill
npm run smoke:install
npm run smoke:mcp
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for details.

## License

[MIT](LICENSE)
