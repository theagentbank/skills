# Security Policy

AgentBank skills can guide coding agents to configure local MCP servers and
initiate payment workflows. We treat bootstrap integrity, instruction safety,
credential handling, confirmation boundaries, and payment-state reporting as
security-sensitive.

## Supported versions

| Version | Supported |
| --- | --- |
| 1.x | Yes |
| Earlier versions | No |

Install from the default branch or update the skill before reporting an issue.

## Report a vulnerability

Do not open a public issue. Submit a private report through
[GitHub Security Advisories](https://github.com/theagentbank/skills/security/advisories/new).

Include:

- the affected commit or skill version;
- impact and realistic attack scenario;
- minimal reproduction steps;
- relevant client and operating-system versions;
- a suggested mitigation, if known.

Never include live private keys, seed phrases, AgentBank JWTs, Privy tokens,
authorization keys, World ID proofs, or other personal data. Use clearly fake
values in reproductions.

## Security boundaries

- The bootstrap adds only the documented `agentbank` stdio command. It performs
  a no-op for accepted exact configurations and refuses to overwrite conflicts.
- The skill does not contain or distribute AgentBank credentials.
- AgentBank Core, not the skill, authorizes payments and owns executable
  transaction instructions.
- Human confirmation remains required for material financial and security-policy
  changes.

General usage questions belong in [SUPPORT.md](SUPPORT.md).
