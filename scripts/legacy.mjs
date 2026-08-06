import { readFile } from 'node:fs/promises';
import path from 'node:path';

export const REFERENCE_FILES = [
  'onboarding.md',
  'identity.md',
  'payments.md',
  'recipients-wallets.md',
  'recovery.md',
];

export function normalizeLineEndings(text) {
  return text.replace(/\r\n?/g, '\n');
}

const PORTABLE_BOOTSTRAP = `If the tools are absent and the user explicitly asked to set up or onboard
AgentBank, configure only the active client. Inspect first and never overwrite
an existing conflicting server.

For Codex:

\`\`\`bash
codex mcp get agentbank --json
\`\`\`

Only when that reports the server is missing:

\`\`\`bash
codex mcp add agentbank -- npx -y agent-bank-mcp@latest
\`\`\`

For Claude Code, use \`claude mcp get agentbank\`, then add a missing server with
\`claude mcp add --scope user agentbank -- npx -y agent-bank-mcp@latest\`.
For Hermes, run \`hermes mcp add agentbank --command npx --args -y agent-bank-mcp@latest\`,
then \`/reload-mcp\`.

If an \`agentbank\` server exists but differs from the documented command, stop
and show the conflict. After configuration, restart the active client once and
repeat: \`Onboard a new agent\`. Do not attempt onboarding before the tools load.`;

function renderPortableBody(body) {
  const bootstrap = /If the tools are absent in Codex[\s\S]*?Do not attempt onboarding before the tools load\./;
  if (!bootstrap.test(body)) {
    throw new Error('SKILL.md is missing the canonical MCP bootstrap section');
  }
  return body
    .replace(bootstrap, PORTABLE_BOOTSTRAP)
    .replace(
      'Read [onboarding.md](references/onboarding.md) when installing, onboarding,\nchecking account readiness, revoking an installation, or resuming after the\none-time restart.',
      'Read the \"Setup and onboarding\" section below when installing, onboarding,\nchecking account readiness, revoking an installation, or resuming after the\none-time restart.',
    )
    .replace(/\n## Route by task[\s\S]*$/, '');
}

function renderPortableReference(filename, content) {
  if (filename !== 'onboarding.md') return content.trim();
  return content
    .replace(/^## Configure the MCP[\s\S]*?(?=^## Onboard)/m, '')
    .trim();
}

export async function renderLegacy(repoRoot) {
  const skillRoot = path.join(repoRoot, 'skills', 'agentbank-pay');
  const main = normalizeLineEndings(
    await readFile(path.join(skillRoot, 'SKILL.md'), 'utf8'),
  );
  const end = main.indexOf('\n---', 4);
  if (!main.startsWith('---\n') || end < 0) {
    throw new Error('SKILL.md has invalid frontmatter');
  }
  const frontmatterEnd = end + 4;
  const frontmatter = main.slice(0, frontmatterEnd);
  const body = renderPortableBody(main.slice(frontmatterEnd).trim());

  const references = [];
  for (const filename of REFERENCE_FILES) {
    const content = normalizeLineEndings(
      await readFile(path.join(skillRoot, 'references', filename), 'utf8'),
    );
    references.push(renderPortableReference(filename, content));
  }

  return `${frontmatter}

<!-- GENERATED from theagentbank/skills. Do not edit this compatibility copy directly. -->

${body}

## Detailed workflow references

${references.join('\n\n---\n\n')}
`;
}
