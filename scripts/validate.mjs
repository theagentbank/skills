#!/usr/bin/env node

import { access, readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseDocument } from 'yaml';
import { REFERENCE_FILES, renderLegacy } from './legacy.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const skillRoot = path.join(root, 'skills', 'agentbank-pay');
const errors = [];
const required = [
  'README.md',
  'CHANGELOG.md',
  'CONTRIBUTING.md',
  'LICENSE',
  'SECURITY.md',
  'SUPPORT.md',
  'protocol-core-sync.json',
  'skills/agentbank-pay/SKILL.md',
  'skills/agentbank-pay/agents/openai.yaml',
  'skills/agentbank-pay/scripts/setup-mcp.mjs',
  'scripts/check-protocol-drift.mjs',
  'scripts/smoke-install.mjs',
  'scripts/smoke-mcp.mjs',
  ...REFERENCE_FILES.map((file) => `skills/agentbank-pay/references/${file}`),
];
const ignoredDirectories = new Set(['.git', 'node_modules', '.tmp']);
const forbiddenPublisherFiles = [
  'skills-lock.json',
  '.agents/skills/agentbank-pay/SKILL.md',
  '.claude/skills/agentbank-pay/SKILL.md',
  '.codex/skills/agentbank-pay/SKILL.md',
];

async function exists(absolute) {
  try {
    await access(absolute);
    return true;
  } catch {
    return false;
  }
}

async function collectFiles(directory, current = directory) {
  const files = [];
  for (const entry of await readdir(current, { withFileTypes: true })) {
    if (entry.isDirectory() && ignoredDirectories.has(entry.name)) continue;
    const absolute = path.join(current, entry.name);
    if (entry.isDirectory()) files.push(...(await collectFiles(directory, absolute)));
    else if (entry.isFile()) files.push(path.relative(directory, absolute));
  }
  return files.sort();
}

function parseYaml(text, label) {
  const document = parseDocument(text, { uniqueKeys: true });
  for (const error of document.errors) errors.push(`${label}: ${error.message}`);
  return document.errors.length ? null : document.toJS();
}

function frontmatter(text, label) {
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!match) {
    errors.push(`${label} is missing YAML frontmatter`);
    return null;
  }
  return parseYaml(match[1], `${label} frontmatter`);
}

async function validateLinks(relative, text) {
  for (const match of text.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)) {
    const target = match[1].trim();
    if (/^(?:https?:|mailto:|#)/.test(target)) continue;
    const withoutFragment = target.split('#', 1)[0];
    const absolute = path.resolve(root, path.dirname(relative), withoutFragment);
    if (!absolute.startsWith(`${root}${path.sep}`) || !(await exists(absolute))) {
      errors.push(`${relative} has broken or unsafe link: ${target}`);
    }
  }
}

for (const relative of required) {
  if (!(await exists(path.join(root, relative)))) errors.push(`Missing ${relative}`);
}
for (const relative of forbiddenPublisherFiles) {
  if (await exists(path.join(root, relative))) {
    errors.push(`Local client artifact must not be published: ${relative}`);
  }
}

const allFiles = await collectFiles(root);
const packageJson = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
const skill = await readFile(path.join(skillRoot, 'SKILL.md'), 'utf8');
const properties = frontmatter(skill, 'skills/agentbank-pay/SKILL.md');

if (properties) {
  const name = properties.name;
  const description = properties.description;
  if (
    typeof name !== 'string' ||
    name.length > 64 ||
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name)
  ) {
    errors.push('Skill name must satisfy the Agent Skills naming rules');
  }
  if (name !== path.basename(skillRoot)) {
    errors.push('Skill name must match its parent directory');
  }
  if (
    typeof description !== 'string' ||
    description.length < 1 ||
    description.length > 1024
  ) {
    errors.push('Skill description must contain 1-1024 characters');
  }
  if (properties.license !== 'MIT') errors.push('Skill frontmatter license must be MIT');
  if (
    typeof properties.compatibility !== 'string' ||
    properties.compatibility.length < 1 ||
    properties.compatibility.length > 500
  ) {
    errors.push('Skill compatibility must contain 1-500 characters');
  }
  if (
    !properties.metadata ||
    properties.metadata.author !== 'theagentbank' ||
    properties.metadata.version !== packageJson.version
  ) {
    errors.push('Skill metadata author/version must match the publisher and package version');
  }
  if (
    Object.values(properties.metadata ?? {}).some((value) => typeof value !== 'string')
  ) {
    errors.push('Skill metadata values must all be strings');
  }
}
if (skill.split(/\r?\n/).length > 500) {
  errors.push('SKILL.md exceeds the 500-line progressive-disclosure recommendation');
}
for (const filename of REFERENCE_FILES) {
  if (!skill.includes(`](references/${filename})`)) {
    errors.push(`SKILL.md must link references/${filename}`);
  }
}

const openAiText = await readFile(
  path.join(skillRoot, 'agents', 'openai.yaml'),
  'utf8',
);
const openAi = parseYaml(openAiText, 'agents/openai.yaml');
if (
  typeof openAi?.interface?.display_name !== 'string' ||
  typeof openAi?.interface?.short_description !== 'string' ||
  !openAi?.interface?.default_prompt?.includes('$agentbank-pay')
) {
  errors.push('agents/openai.yaml must provide complete interface metadata and name $agentbank-pay');
}

if (packageJson.private !== true) errors.push('The publisher package must remain private');
if (packageJson.engines?.node !== '>=22.20.0') {
  errors.push('package.json must match the current Skills CLI Node.js requirement');
}
if (packageJson.repository?.url !== 'https://github.com/theagentbank/skills.git') {
  errors.push('package.json repository URL is incorrect');
}
const readme = await readFile(path.join(root, 'README.md'), 'utf8');
if (!readme.includes('npx skills add theagentbank/skills')) {
  errors.push('README.md must contain the public installation command');
}

try {
  const marker = JSON.parse(
    await readFile(path.join(root, 'protocol-core-sync.json'), 'utf8'),
  );
  if (!/^[0-9a-f]{40}$/.test(marker.source_commit ?? '')) {
    errors.push('protocol-core-sync.json source_commit must be a full Git commit');
  }
  if (Number.isNaN(Date.parse(marker.source_committed_at))) {
    errors.push('protocol-core-sync.json source_committed_at must be an ISO timestamp');
  }
} catch (error) {
  errors.push(`protocol-core-sync.json is invalid: ${error.message}`);
}

const secretPatterns = [
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /\b(?:seed phrase|private key)\s*[:=]\s*["'][^"']+["']/i,
  /\b(?:JWT|PRIVY_TOKEN|AUTHORIZATION_KEY)\s*=\s*\S+/,
  /\bgh[oprsu]_[A-Za-z0-9_]{20,}\b/,
];
const textExtensions = new Set(['.json', '.md', '.mjs', '.yaml', '.yml']);
for (const relative of allFiles) {
  const extension = path.extname(relative);
  if (!textExtensions.has(extension)) continue;
  const content = await readFile(path.join(root, relative), 'utf8');
  if (!content.endsWith('\n')) errors.push(`${relative} must end with a newline`);
  if (extension === '.yaml' || extension === '.yml') parseYaml(content, relative);
  if (extension === '.json') {
    try {
      JSON.parse(content);
    } catch (error) {
      errors.push(`${relative}: invalid JSON (${error.message})`);
    }
  }
  await validateLinks(relative, content);
  for (const pattern of secretPatterns) {
    if (pattern.test(content)) errors.push(`Potential secret in ${relative}`);
  }
}

if (process.platform !== 'win32') {
  for (const relative of [
    'scripts/check-protocol-drift.mjs',
    'scripts/export-legacy-skill.mjs',
    'scripts/smoke-install.mjs',
    'scripts/smoke-mcp.mjs',
    'scripts/sync-protocol-core.mjs',
    'scripts/validate.mjs',
    'skills/agentbank-pay/scripts/setup-mcp.mjs',
  ]) {
    const info = await stat(path.join(root, relative));
    if ((info.mode & 0o111) === 0) errors.push(`${relative} must be executable`);
  }
}

try {
  const trackedLegacy = await readFile(
    path.join(root, 'dist', 'agentbank-pay', 'SKILL.md'),
    'utf8',
  );
  if (trackedLegacy !== (await renderLegacy(root))) {
    errors.push('Legacy artifact drifted; run npm run export:legacy');
  }
} catch {
  errors.push('Missing legacy artifact; run npm run export:legacy');
}

if (errors.length) {
  process.stderr.write(`${errors.map((error) => `- ${error}`).join('\n')}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write(`Validation passed for ${allFiles.length} publishable files\n`);
}
