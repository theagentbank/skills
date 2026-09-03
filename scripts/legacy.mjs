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
repeat: \`Onboard a new agent\`. Do not attempt onboarding before the tools load.

Run onboarding only through the configured AgentBank MCP server in the active
client and profile. Never use a standalone \`npx\` process or a temporary MCP
client to bypass missing tools. After browser approval, call \`whoami\`, restart
or reload that same client, and call \`whoami\` again. Report setup complete only
after the post-restart call succeeds.`;

function compactPortableMarkdown(markdown) {
  const output = [];
  let joinAt = null;
  let fenced = false;

  for (const line of markdown.split('\n')) {
    if (/^```/.test(line)) {
      output.push(line);
      fenced = !fenced;
      joinAt = null;
      continue;
    }
    if (fenced) {
      output.push(line);
      continue;
    }
    if (!line.trim()) {
      output.push('');
      joinAt = null;
      continue;
    }
    if (/^#{1,6}\s/.test(line)) {
      output.push(line);
      joinAt = null;
      continue;
    }
    if (/^\s*(?:[-*+] |\d+\. |>|\|)/.test(line)) {
      output.push(line.trimEnd());
      joinAt = output.length - 1;
      continue;
    }
    if (joinAt !== null) {
      output[joinAt] += ` ${line.trim()}`;
    } else {
      output.push(line.trimEnd());
      joinAt = output.length - 1;
    }
  }

  return output.join('\n');
}

function renderPortableBody(body) {
  const bootstrap = /If the tools are absent in Codex[\s\S]*?Do not attempt onboarding before the tools load\./;
  if (!bootstrap.test(body)) {
    throw new Error('SKILL.md is missing the canonical MCP bootstrap section');
  }
  return compactPortableMarkdown(body
    .replace(bootstrap, PORTABLE_BOOTSTRAP)
    .replace(
      'Read [onboarding.md](references/onboarding.md) when installing, onboarding,\nchecking account readiness, revoking an installation, or resuming after the\none-time restart.',
      'Read the \"Setup and onboarding\" section below when installing, onboarding,\nchecking account readiness, revoking an installation, or resuming after the\none-time restart.',
    )
    .replace(
      /\nRun onboarding only through the configured AgentBank MCP server in the active\nclient and profile\. Never use `hermes mcp test`, a standalone `npx` process, a\ntemporary Node\/Python MCP client, or another client\/profile to bypass missing\ntools\. A temporary process cannot prove the configured client can restore its\nlocal installation\.\n\nAfter browser approval, call `whoami` on that same MCP connection, reload or\nrestart the active client once, then call `whoami` again\. Report setup complete\nonly after the post-restart call succeeds\.\n/,
      '',
    )
    .replace(
      /\nAfter installing in Hermes, reload the MCP and preserve the original request\nonce the tools become available\.\n\nFor a payment-only request with missing tools, explain the required user-level\nMCP configuration and obtain permission before changing it\.\n\nRead the "Setup and onboarding" section below when installing, onboarding,\nchecking account readiness, revoking an installation, or resuming after the\none-time restart\.\n/,
      '',
    )
    .replace(
      /\n## Runtime guidance\n\nAt the start of an unfamiliar or resumed workflow, call `get_instructions` with\nthe relevant journey:\n\n```text\nsetup\npay\ntrack\nrecover\nmanage_recipients\nmanage_wallets\n```\n\nThe MCP resources `agentbank:\/\/guides\/routing` and\n`agentbank:\/\/instructions\/\{journey\}` are also authoritative\. Follow newer\nruntime guidance when it does not conflict with the invariants above\.\n/,
      '\n## Runtime guidance\n\nFor setup, pay, track, recover, recipient, or wallet work, call `get_instructions` with the relevant journey. The `agentbank://guides/routing` and `agentbank://instructions/{journey}` resources are also authoritative.\n',
    )
    .replace(/\n## Route by task[\s\S]*$/, ''));
}

function renderPortableReference(filename, content) {
  if (filename !== 'onboarding.md') return compactPortableMarkdown(content.trim());
  return compactPortableMarkdown(content
    .replace(/^## Configure the MCP[\s\S]*?(?=^## Onboard)/m, '')
    .trim());
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

${body}

## Detailed workflow references

${references.join('\n\n---\n\n')}
`;
}
