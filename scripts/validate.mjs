#!/usr/bin/env node

import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { REFERENCE_FILES, renderLegacy } from './legacy.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const skillRoot = path.join(root, 'skills', 'agentbank-pay');
const errors = [];
const required = [
  'README.md',
  'LICENSE',
  'SECURITY.md',
  'skills/agentbank-pay/SKILL.md',
  'skills/agentbank-pay/agents/openai.yaml',
  'skills/agentbank-pay/scripts/setup-mcp.mjs',
  'scripts/smoke-mcp.mjs',
  ...REFERENCE_FILES.map((file) => `skills/agentbank-pay/references/${file}`),
];

for (const relative of required) {
  await access(path.join(root, relative)).catch(() => errors.push(`Missing ${relative}`));
}

const skill = await readFile(path.join(skillRoot, 'SKILL.md'), 'utf8');
const frontmatter = skill.match(/^---\n([\s\S]*?)\n---/);
if (!frontmatter) errors.push('SKILL.md is missing YAML frontmatter');
if (!/^name:\s*agentbank-pay$/m.test(frontmatter?.[1] ?? '')) {
  errors.push('SKILL.md frontmatter must name agentbank-pay');
}
if (!/^description:\s*\S.+$/m.test(frontmatter?.[1] ?? '')) {
  errors.push('SKILL.md frontmatter needs a description');
}

for (const match of skill.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)) {
  if (/^(https?:|#)/.test(match[1])) continue;
  await access(path.resolve(skillRoot, match[1])).catch(() =>
    errors.push(`Broken SKILL.md link: ${match[1]}`),
  );
}

const metadata = await readFile(
  path.join(skillRoot, 'agents', 'openai.yaml'),
  'utf8',
);
if (!metadata.includes('$agentbank-pay')) {
  errors.push('agents/openai.yaml default_prompt must mention $agentbank-pay');
}

const secretPatterns = [
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /\b(?:seed phrase|private key)\s*[:=]\s*["'][^"']+["']/i,
  /\b(?:JWT|PRIVY_TOKEN|AUTHORIZATION_KEY)\s*=\s*\S+/,
];
for (const relative of required) {
  let content = '';
  try {
    content = await readFile(path.join(root, relative), 'utf8');
  } catch {
    continue;
  }
  for (const pattern of secretPatterns) {
    if (pattern.test(content)) errors.push(`Potential secret in ${relative}`);
  }
}

try {
  const trackedLegacy = await readFile(
    path.join(root, 'dist', 'agentbank-pay', 'SKILL.md'),
    'utf8',
  );
  const expectedLegacy = await renderLegacy(root);
  if (trackedLegacy !== expectedLegacy) {
    errors.push('Legacy artifact drifted; run npm run export:legacy');
  }
} catch {
  errors.push('Missing legacy artifact; run npm run export:legacy');
}

if (errors.length) {
  process.stderr.write(`${errors.map((error) => `- ${error}`).join('\n')}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write('Validation passed\n');
}
