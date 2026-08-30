# Contributing to AgentBank Skills

Thank you for improving the AgentBank agent experience.

## Source of truth

The modular skill under `skills/agentbank-pay/` is canonical:

- `SKILL.md` contains activation, routing, and non-negotiable safety rules.
- `references/` contains focused workflow details loaded on demand.
- `scripts/setup-mcp.mjs` contains the conflict-safe client bootstrap.

Do not edit `dist/agentbank-pay/SKILL.md` directly. It is the deterministic,
single-file compatibility export used by `protocol-core`.

Local client output such as `.agents/`, `.claude/`, `.codex/`, and
`skills-lock.json` is deliberately ignored and must not be committed.

## Development checks

Use Node.js 22.20 or newer and install the locked dependencies:

```bash
npm ci
npm run check
```

Before requesting review, run the full external checks:

```bash
npm run smoke:install
npm run smoke:mcp
```

`smoke:install` performs clean copied installations for Codex and Claude Code.
`smoke:mcp` initializes `agent-bank-mcp@latest`, resolves npm's current latest
version, and checks that MCP initialize reports that same version and production tool
catalog and critical input-schema boundaries. It never starts onboarding or
moves funds.

For a pre-publish release candidate, point the same check at its packed tarball:

```bash
AGENTBANK_MCP_PACKAGE=../protocol-core/mcp-agent-server/agent-bank-mcp-candidate.tgz AGENTBANK_MCP_EXPECTED_VERSION=0.1.27 npm run smoke:mcp
```

The default command intentionally resolves `agent-bank-mcp@latest` from npm and
fails when its initialize version, exact production catalog, or critical schemas
drift from the recorded release contract. A future candidate must use a new npm
version; never reuse an already-published version for changed source.

## Editing the skill

- Follow the [Agent Skills specification](https://agentskills.io/specification).
- Keep `SKILL.md` concise and route details into one-level-deep references.
- Preserve explicit human confirmation for payments, wallet execution,
  recipient replacement, revocation, and approval-policy changes.
- Never add credentials, identity proofs, private keys, or examples that look
  like real secrets.
- Add a regression test for every workflow or bootstrap behavior change.
- Update the package and skill metadata versions for a user-visible release.
- Add user-visible changes to [CHANGELOG.md](CHANGELOG.md).

Regenerate the compatibility artifact after canonical skill changes:

```bash
npm run export:legacy
```

## Synchronizing protocol-core

1. Detect source changes:

   ```bash
   npm run check:protocol-drift -- --target ../protocol-core
   ```

2. Audit the reported commits against MCP registrations, schemas, runtime
   guidance, and Core behavior.
3. Update the canonical skill and tests.
4. Record the audited source commit in `protocol-core-sync.json`.
5. Regenerate and verify:

   ```bash
   npm run export:legacy
   npm run check
   npm run smoke:mcp
   ```

6. Sync the compatibility copy:

   ```bash
   npm run sync:protocol-core -- --target ../protocol-core
   ```

The sync command writes only the AgentBank skill and OpenAI interface metadata
beneath `mcp-agent-server/skills/agentbank-pay`.

## Pull requests

Keep changes narrowly scoped and explain:

- the user-visible behavior being changed;
- the protocol or client evidence behind it;
- safety implications;
- commands used to validate it.

Complete the repository pull request template before requesting review.
