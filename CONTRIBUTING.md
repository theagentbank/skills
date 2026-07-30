# Contributing

## Local checks

Use Node.js 18 or newer:

```bash
npm install
npm run check
npx skills add . --list
```

The main skill is canonical. Keep detailed workflows in `references/` and link
them from `SKILL.md` so clients can load them only when needed.

## Legacy compatibility

Generate the tracked single-file artifact:

```bash
npm run export:legacy
```

To update a local `protocol-core` checkout:

```bash
npm run sync:protocol-core -- --target ../protocol-core
```

The sync command only writes the existing AgentBank skill and its OpenAI
metadata beneath `mcp-agent-server/skills/agentbank-pay`.

## Pull requests

- Never commit credentials, private keys, tokens, or World ID proofs.
- Add or update tests for bootstrap behavior.
- Run `npm run check` before opening a pull request.
