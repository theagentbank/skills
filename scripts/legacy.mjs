import { readFile } from 'node:fs/promises';
import path from 'node:path';

export const REFERENCE_FILES = [
  'onboarding.md',
  'identity.md',
  'payments.md',
  'recipients-wallets.md',
  'recovery.md',
];

export async function renderLegacy(repoRoot) {
  const skillRoot = path.join(repoRoot, 'skills', 'agentbank-pay');
  const main = await readFile(path.join(skillRoot, 'SKILL.md'), 'utf8');
  const end = main.indexOf('\n---', 4);
  if (!main.startsWith('---\n') || end < 0) {
    throw new Error('SKILL.md has invalid frontmatter');
  }
  const frontmatterEnd = end + 4;
  const frontmatter = main.slice(0, frontmatterEnd);
  let body = main.slice(frontmatterEnd).trim();
  body = body.replace(/\[([^\]]+)\]\(references\/[^)]+\)/g, '$1');

  const references = [];
  for (const filename of REFERENCE_FILES) {
    const content = await readFile(path.join(skillRoot, 'references', filename), 'utf8');
    references.push(content.trim());
  }

  return `${frontmatter}

<!-- GENERATED from theagentbank/skills. Do not edit this compatibility copy directly. -->

${body}

## Detailed workflow references

${references.join('\n\n---\n\n')}
`;
}
